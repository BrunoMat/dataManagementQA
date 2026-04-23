// ============================================================
//  apps/management-test/server/services/to.service.js
//
//  Transfer Order — busca inventário cruzado entre CD e HUB,
//  cria Transfer_Order__c e Transfer_Order_Line_Item__c no SF.
//
//  Fluxo:
//    1. getInventory(locationName) → produtos em estoque
//    2. getCrossInventory(cd, hub) → interseção CD ∩ HUB
//    3. createTO(cd, hub)          → POST Transfer_Order__c
//    4. createTOLI(toId, items)    → POST TOLI em lotes de 25
// ============================================================
'use strict';

const sf     = require('../../../../packages/salesforce/index');
const config = require('../config/sf.config');
const hubService = require('./hub.service');

const SF_VER      = () => process.env.SF_API_VERSION || config.apiVersion || 'v56.0';
const JOKR_ENTITY = process.env.SF_JOKR_ENTITY || '0015e00000swNIlAAM';

// ── Hub ID resolver ──────────────────────────────────────────

async function getHubId(hubName) {
  const data = await sf.query(
    `SELECT Id FROM Hub__c WHERE Name='${hubName}' LIMIT 1`
  );
  return data.records?.[0]?.Id || null;
}

// ── Inventário de um location ────────────────────────────────

/**
 * Busca todos os produtos ativos de um location (CD-Stock ou HUB-Stock).
 * Retorna campos necessários para montar o payload de TOLI.
 */
async function getInventory(locationName) {
  const products = await hubService.getHubProducts(locationName);

  if (products.length === 0) {
    console.warn(`[to] Nenhum produto em estoque cacheado para '${locationName}'`);
    return [];
  }

  // Mapeia para o formato que o to.service espera (campos de Inventory__c)
  return products.map(p => ({
    inventoryId:    p.inventory_id, // Inventory__c ID
    productId:      p.product_id,    // ID do Product__c
    productName:    p.name,
    barcode:        p.barcode,
    sku:            p.sku,
    temperature:    p.temperature,
    hubInventoryId: p.salesforce_id, // Hub_Inventory__c ID
    hubLocationId:  p.location_id || '', 
    locationName:   locationName,
  }));
}

// ── Inventário cruzado CD ∩ HUB ──────────────────────────────

/**
 * Retorna produtos que existem tanto no CD quanto no HUB,
 * já com os campos necessários para criar TOLI.
 */
async function getCrossInventory(cdName, hubName) {
  const [cdProducts, hubProducts] = await Promise.all([
    getInventory(cdName),
    getInventory(hubName),
  ]);

  // Indexa HUB por productId para lookup rápido
  const hubMap = new Map();
  hubProducts.forEach(p => {
    hubMap.set(p.productId, p);
  });

  // Interseção: só produtos que existem em ambos
  const cross = [];
  for (const cdProd of cdProducts) {
    const hubProd = hubMap.get(cdProd.productId);
    if (hubProd) {
      cross.push({
        productId:        cdProd.productId,
        productName:      cdProd.productName,
        barcode:          cdProd.barcode,
        sku:              cdProd.sku,
        temperature:      cdProd.temperature,
        // Campos do CD (origem)
        fromInventoryId:  cdProd.inventoryId,
        fromHubProduct:   cdProd.hubInventoryId,
        fromLocation:     cdProd.hubLocationId,
        // Campos do HUB (destino)
        toInventoryId:    hubProd.inventoryId,
        toHubProduct:     hubProd.hubInventoryId,
      });
    }
  }

  return {
    cdName,
    hubName,
    cdTotal:  cdProducts.length,
    hubTotal: hubProducts.length,
    total:    cross.length,
    products: cross,
  };
}

// ── Criar Transfer Order ─────────────────────────────────────

async function createTO({ cdName, hubName, cdId, hubId }) {
  const body = await sf.composite({
    allOrNone: true,
    compositeRequest: [{
      method:      'POST',
      url:         `/services/data/${SF_VER()}/sobjects/Transfer_Order__c`,
      referenceId: 'TO',
      body: {
        Transfer_From__c:   cdId,
        Transfer_To__c:     hubId,
        JOKR_Entity__c:     JOKR_ENTITY,
        Transfer_Type__c:   'Receive and Stow',
        Date_Scheduled__c:  new Date().toISOString(),
      },
    }],
  });

  const ref = body.compositeResponse[0];
  if (ref.httpStatusCode >= 400) {
    throw Object.assign(
      new Error('Erro ao criar Transfer Order: ' + JSON.stringify(ref.body)),
      { status: 422 }
    );
  }

  console.log(`[to] ✓ TO criada: ${ref.body.id} (${cdName} → ${hubName})`);
  return ref.body.id;
}

// ── Criar Transfer Order Line Items ──────────────────────────

/**
 * Cria TOLIs em lotes de até 25 (limite do Composite API).
 * @param {string} toId - ID da Transfer Order
 * @param {Array}  items - produtos com qty e campos de inventário
 * @returns {Promise<string[]>} IDs dos TOLIs criados
 */
async function createTOLI(toId, items) {
  const BATCH_SIZE = 25;
  const allIds = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    const body = await sf.composite({
      allOrNone: true,
      compositeRequest: batch.map((item, idx) => ({
        method:      'POST',
        url:         `/services/data/${SF_VER()}/sobjects/Transfer_Order_Line_Item__c`,
        referenceId: `TOLI_${i + idx}`,
        body: {
          Status__c:             'Open',
          Transfer_Order__c:     toId,
          Product__c:            item.productId,
          From_Hub_Product__c:   item.fromHubProduct,
          To_Hub_Product__c:     item.toHubProduct,
          From_Inventory__c:     item.fromInventoryId,
          To_Inventory__c:       item.toInventoryId,
          Pick_Location__c:      item.fromLocation,
          Original_Quantity__c:  item.qty,
        },
      })),
    });

    const batchIds = body.compositeResponse
      .filter(r => r.httpStatusCode < 400)
      .map(r => r.body.id);

    const failed = body.compositeResponse.filter(r => r.httpStatusCode >= 400);
    if (failed.length) {
      console.error(`[to] ${failed.length} TOLI(s) falharam no lote ${i}:`, JSON.stringify(failed));
    }

    allIds.push(...batchIds);
  }

  console.log(`[to] ✓ ${allIds.length}/${items.length} TOLIs criados para TO ${toId}`);
  return allIds;
}

// ── Orquestrador: criar TO completa ──────────────────────────

/**
 * Fluxo completo: resolve IDs, cria TO e TOLIs.
 * @param {object} params
 * @param {string} params.cdName  - Nome do CD origem (ex: 'SAO903')
 * @param {string} params.hubName - Nome do HUB destino (ex: 'SAO022')
 * @param {Array}  params.products - [{ productId, qty, fromHubProduct, ... }]
 */
async function createFullTO({ cdName, hubName, products }) {
  console.log(`\n[to] ▶ Criando TO: ${cdName} → ${hubName} (${products.length} produtos)`);

  const [cdId, hubId] = await Promise.all([
    getHubId(cdName),
    getHubId(hubName),
  ]);

  if (!cdId) throw Object.assign(new Error(`CD '${cdName}' não encontrado no SF`), { status: 404 });
  if (!hubId) throw Object.assign(new Error(`HUB '${hubName}' não encontrado no SF`), { status: 404 });

  // 1. Cria Transfer Order
  const toId = await createTO({ cdName, hubName, cdId, hubId });

  // 2. Cria TOLIs
  const toliIds = await createTOLI(toId, products);

  const result = {
    toId,
    toliIds,
    toliCount: toliIds.length,
    cdName,
    hubName,
  };

  console.log(`[to] ✅ TO completa: ${toId} | ${toliIds.length} TOLIs\n`);
  return result;
}

module.exports = {
  getHubId,
  getInventory,
  getCrossInventory,
  createTO,
  createTOLI,
  createFullTO,
};
