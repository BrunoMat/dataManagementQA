// ============================================================
//  apps/management-test/server/services/vendor.service.js
// ============================================================
'use strict';

const sf      = require('../../../../packages/salesforce/index');
const config  = require('../config/sf.config');
const Product = require('../models/Product');
const Vendor  = require('../models/Vendor');

// ── Resolve Account ID ─────────────────────────────────────
async function resolveAccountId({ sfAccountId, cnpj, cnpjName }) {
  // 1. Tenta buscar no MongoDB primeiro
  let vendor = null;
  if (sfAccountId) {
    vendor = await Vendor.findOne({ 
      $or: [
        { sf_account_id: sfAccountId },
        { id: sfAccountId }
      ]
    });
  } else if (cnpj) {
    const taxId = cnpj.replace(/\D/g, '');
    vendor = await Vendor.findOne({ cnpj: taxId });
  }

  if (vendor && vendor.sf_account_id) {
    console.log(`[resolveAccountId] Vendor resolvido para SF ID: ${vendor.name} (${vendor.sf_account_id})`);
    return vendor.sf_account_id;
  }
  
  if (vendor) {
    console.log(`[resolveAccountId] Vendor local encontrado sem SF ID: ${vendor.name} (${vendor.id})`);
    return vendor.id;
  }

  // 2. Se não estiver no DB, busca no Salesforce e salva em cache
  let resolvedId = sfAccountId;
  if (!resolvedId || cnpj) {
    const TAX_ID = (cnpj || '').replace(/\D/g, '');
    let where = '';
    if (TAX_ID.length === 14) where = `Tax_Id__c='${TAX_ID}'`;
    if (cnpjName) where += (where ? ' AND ' : '') + `Name='${cnpjName}'`;

    if (where) {
      console.log(`[resolveAccountId] Buscando Account no SF: ${where}`);
      const data = await sf.query(`SELECT Id, Name, Tax_Id__c FROM Account WHERE ${where} LIMIT 1`);
      const acc = data.records?.[0];
      if (acc) {
        resolvedId = acc.Id;
        // Salva vendor em cache
        await Vendor.findOneAndUpdate(
          { sf_account_id: resolvedId },
          { 
            id: 'ven-' + Math.random().toString(36).slice(2, 7),
            name: acc.Name,
            cnpj: acc.Tax_Id__c,
            sf_account_id: resolvedId 
          },
          { upsert: true, new: true }
        );
        console.log(`[resolveAccountId] Vendor cacheado do SF: ${resolvedId}`);
      }
    }
  }

  // Se resolveu para algo (SF ID ou valor inicial), retorna. 
  // Senão, retorna o input original como fallback.
  const finalId = resolvedId || sfAccountId;
  console.log(`[resolveAccountId] Final ID resolvido: ${finalId}`);
  return finalId;
}

// ── Vendors por hub ─────────────────────────────────────────
async function getVendorsByHub({ hubId, hubName, uom = config.uomDefault }) {
  const HubVendor = require('../models/HubVendor');
  const Vendor = require('../models/Vendor');

  // 1. Busca associações manuais no MongoDB
  const query = hubId ? { hub_id: hubId } : { hub_id: hubName };
  const manualLinks = await HubVendor.find(query);
  const manualVendorIds = manualLinks.map(l => l.vendor_id);
  
  const manualVendors = await Vendor.find({ 
    $or: [
      { id: { $in: manualVendorIds } },
      { sf_account_id: { $in: manualVendorIds } }
    ]
  });

  // 2. Busca associações no Salesforce (Discovery)
  let sfVendors = [];
  try {
    const vendorData = await sf.query(
      `SELECT Account__c, MAX(Account__r.Name) AccountName, COUNT(Id) totalVendorProducts ` +
      `FROM Vendor_Product__c ` +
      `WHERE Standard_Invoice_Unit_Measure__c = '${uom}' ` +
      `GROUP BY Account__c ORDER BY COUNT(Id) DESC LIMIT 50`
    );
    sfVendors = (vendorData.records || []).map(r => ({
      accountId:    r.Account__c,
      accountName:  r.AccountName,
      productCount: r.totalVendorProducts,
      source: 'salesforce'
    }));
  } catch (err) {
    console.warn('[getVendorsByHub] Erro Salesforce:', err.message);
  }

  // Mergear resultados
  let finalVendors = [];
  if (hubId || hubName) {
    console.log(`[getVendorsByHub] Filtragem estrita para Hub: ${hubId || hubName}. ${manualVendors.length} vendors vinculados.`);
    finalVendors = manualVendors.map(v => ({
      accountId:    v.sf_account_id,
      accountName:  v.name,
      id:           v.id,
      productCount: 0,
      source: 'manual'
    }));
  } else {
    const seenIds = new Set(manualVendors.map(v => v.sf_account_id));
    finalVendors = manualVendors.map(v => ({
      accountId:    v.sf_account_id,
      accountName:  v.name,
      id:           v.id,
      productCount: 0,
      source: 'manual'
    })).concat(sfVendors.filter(v => !seenIds.has(v.accountId)));
  }

  return { hubId, hubName, uom, vendors: finalVendors };
}

// ── IDs de produtos (para intersecção com estoque) ──────────
async function getProductIdsByVendor(accountIdOrName, uom, isId = false) {
  let accId = accountIdOrName;
  
  if (isId) {
    try {
      accId = await resolveAccountId({ sfAccountId: accountIdOrName });
    } catch (err) {
      console.warn(`[getProductIdsByVendor] Erro resolveAccountId: ${err.message}`);
    }
  }

  // 1. TENTA CACHE MONGODB (CACHE-FIRST)
  const cachedIds = await Product.find(
    { 
      vendor_id: accId, 
      uom: { $regex: new RegExp("^" + uom + "$", "i") }, 
      active: true 
    }, 
    'productId'
  );

  if (cachedIds.length > 0) {
    console.log(`[getProductIdsByVendor] Usando ${cachedIds.length} IDs do cache MongoDB.`);
    return cachedIds.map(p => p.productId);
  }

  // 2. FALLBACK SALESFORCE
  console.log(`[getProductIdsByVendor] Cache vazio. Consultando Salesforce para ${accId}...`);
  const where = isId
    ? `Account__c = '${accId}'`
    : `Account__r.Name = '${accId}'`;

  const data = await sf.query(
    `SELECT Product__c FROM Vendor_Product__c ` +
    `WHERE ${where} AND CurrencyIsoCode = 'BRL' ` +
    `AND Standard_Invoice_Unit_Measure__c = '${uom}'`
  );
  return data.totalSize > 0 ? data.records.map(r => r.Product__c) : [];
}

// ── Detalhes completos para PO ──────────────────────────────
async function enrichProductDetails(products, vendorName, poId) {
  const requests = products.map(async (produto) => {
    try {
      // Tenta buscar do cache primeiro
      let cached = await Product.findOne({ 
        productId: produto.Product__c, // Usando o campo correto do modelo
        active: true 
      });
      
      if (!cached) {
        // Fallback por Product__c (Salesforce ID) se o campo for diferente
        cached = await Product.findOne({ Product__c: produto.Product__c, active: true });
      }

      if (!cached) {
        const data = await sf.query(
          `SELECT Product__c, Product__r.Name, Product__r.Barcode__c, ` +
          `UOM2__c, Last_Cost__c, Unit_Net_Cost__c ` +
          `FROM Vendor_Product__c ` +
          `WHERE Product__c = '${produto.Product__c}' ` +
          `AND Account__r.Name = '${vendorName}' AND CurrencyIsoCode = 'BRL'`
        );
        if (data.records?.length) {
          const r = data.records[0];
          cached = {
            Product__c: r.Product__c,
            productName: r.Product__r?.Name,
            barcode: r.Product__r?.Barcode__c,
            uom: r.UOM2__c,
            lastCost: r.Last_Cost__c,
            unitNetCost: r.Unit_Net_Cost__c ?? 1,
          };
        }
      }

      if (!cached) return null;

      return {
        index:       produto.index,
        vendorName,
        poId,
        ...cached,
        qty:         produto.QtdProdutoPOLI,
      };
    } catch (err) {
      console.error(`[vendor] enrich erro ${produto.Product__c}:`, err.message);
      return null;
    }
  });
  const results = await Promise.all(requests);
  return results.filter(r => r !== null && r.productName !== null);
}

// ── Produtos completos (com Cache MongoDB) ──────────────────
async function getVendorProducts({ sfAccountId, cnpj, cnpjName, uom = config.uomDefault, limit = config.limitProdutos, forceSync = false }) {
  const accId = await resolveAccountId({ sfAccountId, cnpj, cnpjName });

  // 1. Tenta buscar do cache MongoDB
  if (!forceSync) {
    // Busca por vendor_id (que pode ser o SF ID ou o ID local)
    const cachedProducts = await Product.find({ 
      $or: [
        { vendor_id: accId },
        { vendor_id: sfAccountId }
      ], 
      uom: { $regex: new RegExp("^" + uom + "$", "i") },
      active: true 
    });
    if (cachedProducts.length > 0) {
      console.log(`[getVendorProducts] Retornando ${cachedProducts.length} produtos do cache MongoDB`);
      return { 
        accountId: accId, 
        uom, 
        total: cachedProducts.length, 
        products: cachedProducts.map(p => ({
          ...p.toObject(),
          id: p.sfId, 
          cod: p.sku || '', 
          desc: p.name
        })),
        fromCache: true 
      };
    }
  }

  // 2. Busca no Salesforce
  console.log(`[getVendorProducts] Buscando no Salesforce para Account ID: ${accId} (UOM: ${uom})`);
  try {
    const prodData = await sf.query(
      `SELECT Id, Name, Product__c, Product__r.SKU__c, Product__r.Barcode__c, ` +
      `Product__r.Name, Standard_Invoice_Unit_Measure__c, Last_Cost__c, ` +
      `Case_Size__c, Units_per_Secondary_Case__c, Units_per_pallet__c, Units_per_Weight__c ` +
      `FROM Vendor_Product__c ` +
      `WHERE Account__c='${accId}' ` +
      `AND Standard_Invoice_Unit_Measure__c='${uom}'`
    );
    
    console.log(`[getVendorProducts] SF retornou ${prodData.records?.length || 0} produtos.`);

    // ── ESTRATÉGIA DE ATUALIZAÇÃO (MAIS OU MENOS PRODUTOS) ──
    // Se buscamos no SF, marcamos TUDO deste vendor/uom como inativo primeiro.
    // Assim, o que não vier mais no SF ficará como inativo no banco.
    await Product.updateMany(
      { 
        $or: [
          { vendor_id: accId },
          { vendor_id: sfAccountId }
        ],
        uom 
      },
      { $set: { active: false } }
    );

    const products = (prodData.records || []).map((r, idx) => ({
      sfId:                  r.Id,
      cod:                   r.Name                       || '',
      productId:             r.Product__c,
      sku:                   r.Product__r?.SKU__c        || '',
      barcode:               r.Product__r?.Barcode__c    || '',
      desc:                  r.Product__r?.Name          || '',
      cfop:                  r.CFOP__c                   || '5.102',
      uom:                   r.Standard_Invoice_Unit_Measure__c,
      last_cost:             r.Last_Cost__c              || 0,
      unitsPerPrimaryCase:   r.Case_Size__c                ?? (uom === 'ea' ? 1 : null),
      unitsPerSecondaryCase: r.Units_per_Secondary_Case__c ?? null,
      unitsPerPallet:        r.Units_per_pallet__c         ?? null,
      unitsPerWeight:        r.Units_per_Weight__c         ?? null,
      _sfIndex: idx,
    }));
    
    // 3. Salva/Atualiza o cache no MongoDB
    if (products.length > 0) {
      const bulkOps = products.map(p => ({
        updateOne: {
          filter: { sfId: p.sfId },
          update: { 
            $set: { 
              vendor_id: accId,
              name: p.desc,
              sku: p.sku,
              barcode: p.barcode,
              cost: p.last_cost,
              uom: p.uom,
              active: true,
              synced_at: new Date()
            }
          },
          upsert: true
        }
      }));
      await Product.bulkWrite(bulkOps);
      console.log(`[getVendorProducts] Cache MongoDB atualizado: ${products.length} produtos.`);
    }

    return { accountId: accId, uom, total: products.length, products, fromCache: false };

  } catch (err) {
    console.error(`[getVendorProducts] Erro ao sincronizar:`, err.message);
    throw err;
  }
}

module.exports = { 
  getVendorsByHub, 
  getProductIdsByVendor, 
  enrichProductDetails, 
  getVendorProducts, 
  resolveAccountId 
};
