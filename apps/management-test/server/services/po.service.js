// ============================================================
//  apps/management-test/server/services/po.service.js
//
//  Orquestra o fluxo completo de criação de PO + POLI + Invoice
//  espelhando exatamente criacao_PO.js:
//
//  createPoWithPoli()
//    ├── selectProductsPoli()       — intersecção vendor × estoque
//    │     ├── getProductIdsByVendor()
//    │     └── getProductsInStock()
//    └── generatePoPoli()
//          ├── createPO()           — POST Purchase_Order__c
//          ├── enrichProductDetails()— exportVendorProductDetails()
//          ├── createPOLI()         — POST PO_Line_Item__c (por produto)
//          └── createInvoice()      — POST Invoice__c + link PO + InvoiceLI
// ============================================================
'use strict';

const sf               = require('../../../../packages/salesforce/index');
const config           = require('../config/sf.config');
const { generateAccessKey } = require('./nfkey.service');
const { getProductIdsByVendor, enrichProductDetails } = require('./vendor.service');
const { getProductsInStock } = require('./inventory.service');

const SF_VER = () => process.env.SF_API_VERSION || config.apiVersion || 'v56.0';

// ── Helpers ───────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Seleciona aleatoriamente `numeroProdutos` produtos que existem
 * tanto no catálogo do vendor quanto no estoque do hub.
 * Espelha selectProductsPoli() do criacao_PO.js.
 *
 * @returns {Array<{index, Product__c, QtdProdutoPOLI}>}
 */
async function selectProductsPoli({ vendorName, hubName, numeroProdutos, uom }) {
  const [produtosVendor, produtosHub] = await Promise.all([
    getProductIdsByVendor(vendorName, uom),
    getProductsInStock(hubName),
  ]);

  // Intersecção: produtos que existem no vendor E no estoque do hub
  const hubSet              = new Set(produtosHub);
  const produtosCompativeis = produtosVendor.filter(id => hubSet.has(id));

  if (produtosCompativeis.length === 0) {
    throw Object.assign(
      new Error(`Nenhum produto compatível entre vendor '${vendorName}' e hub '${hubName}'`),
      { status: 422 }
    );
  }

  if (produtosCompativeis.length < numeroProdutos) {
    console.warn(
      `[po] Solicitado ${numeroProdutos} produtos, mas apenas ` +
      `${produtosCompativeis.length} compatíveis disponíveis.`
    );
  }

  // Seleção aleatória sem repetição — espelha o while() do original
  const selecionados  = [];
  const indicesUsados = new Set();
  // If numeroProdutos is not provided, select all compatible products
  const limite = (typeof numeroProdutos === 'number' && !Number.isNaN(numeroProdutos))
    ? Math.min(numeroProdutos, produtosCompativeis.length)
    : produtosCompativeis.length;

  while (selecionados.length < limite) {
    const idx = Math.floor(Math.random() * produtosCompativeis.length);
    if (!indicesUsados.has(idx)) {
      indicesUsados.add(idx);
      selecionados.push(produtosCompativeis[idx]);
    }
  }

  // Adiciona índice e quantidade aleatória (1–10)
  return selecionados.map((productId, i) => ({
    index:          i + 1,
    Product__c:     productId,
    QtdProdutoPOLI: Math.floor(Math.random() * 10) + 1,
  }));
}

// ── createPO ──────────────────────────────────────────────────
/**
 * Cria a Purchase_Order__c no SF e retorna o ID.
 * Espelha createPO() do criacao_PO.js.
 */
async function createPO({ accountId, hubId, status = 'Open' }) {
  const dateOnly = new Date().toISOString().slice(0, 10);

  const body = await sf.composite({
    allOrNone: true,
    compositeRequest: [{
      method:      'POST',
      url:         `/services/data/${SF_VER()}/sobjects/Purchase_Order__c`,
      referenceId: 'PO',
      body: {
        Account__c:        accountId,
        CurrencyIsoCode:   'BRL',
        Deliver_To__c:     hubId,
        Date_Scheduled__c: dateOnly,
        Buyer__c:          config.buyerId,
        Status__c:         status,
      },
    }],
  });

  const poRef = body.compositeResponse[0];
  if (poRef.httpStatusCode >= 400) {
    throw Object.assign(new Error('Erro ao criar PO: ' + JSON.stringify(poRef.body)), { status: 422 });
  }

  return poRef.body.id;
}

// ── createPOLI ────────────────────────────────────────────────
/**
 * Cria os PO_Line_Item__c para cada produto enriquecido.
 * Espelha createPOLI() do criacao_PO.js — uma request por produto em paralelo.
 *
 * @param {string} poId
 * @param {Array}  enrichedProducts - resultado de enrichProductDetails()
 * @returns {Promise<string[]>} IDs dos POLIs criados
 */
async function createPOLI(poId, enrichedProducts) {
  await sleep(1000); // mantém o delay do original

  const valids = enrichedProducts.filter(p =>
    p.Product__c && p.qty && p.lastCost
  );

  if (!valids.length) {
    throw Object.assign(new Error('Nenhum produto válido para criar POLI'), { status: 422 });
  }

  const requests = valids.map(async (produto) => {
    const body = await sf.composite({
      allOrNone: true,
      compositeRequest: [{
        method:      'POST',
        url:         `/services/data/${SF_VER()}/sobjects/PO_Line_Item__c`,
        referenceId: `refPoli_${produto.index}`,
        body: {
          Purchase_Order__c: poId,
          Product__c:        produto.Product__c,
          UOM2__c:           produto.uom,
          Quantity__c:       produto.qty,
          Unit_Cost__c:      produto.lastCost,
          Unit_Net_Cost__c:  produto.unitNetCost ?? 1,
        },
      }],
    });

    const ref = body.compositeResponse[0];
    if (ref.httpStatusCode >= 400) {
      console.error(`[po] Erro POLI produto ${produto.Product__c}:`, ref.body);
      return null;
    }
    return ref.body.id;
  });

  const results = await Promise.all(requests);
  return results.filter(id => id !== null);
}

// ── createInvoice ─────────────────────────────────────────────
/**
 * Cria Invoice__c, vincula à PO e cria os Invoice_Line_Item__c.
 * Usa o Composite encadeado (referências @{}) para garantir
 * consistência em uma única transação.
 *
 * @param {object} params
 * @param {string} params.poId
 * @param {string} params.cnpj         - CNPJ do emitente (14 dígitos)
 * @param {Array}  params.products     - enrichedProducts
 * @param {string} [params.nNF]        - número da NF (gerado se omitido)
 * @param {string} [params.accessKey]  - chave 44 dígitos (gerada se omitida)
 */
async function createInvoice({ poId, cnpj, products, nNF, accessKey }) {
  const keyData = generateAccessKey({ cnpj });
  const _nNF       = nNF        || keyData.nNF;
  const _accessKey = accessKey  || keyData.accessKey;

  // Invoice_Line_Items — espelha o invoiceLIRecords do script Postman
  const invLiRecords = products.map((p, i) => ({
    attributes:         { type: 'Invoice_Line_Item__c', referenceId: `INVLI_${i + 1}` },
    Invoice__c:         '@{Invoice.id}',
    Product_Number__c:  p.barcode || '',
    Product_Barcode__c: p.barcode || '',
    UOM_Quantity__c:    p.qty,
  }));

  const compositeBody = {
    allOrNone: true,
    compositeRequest: [
      // 1) Cria Invoice
      {
        method:      'POST',
        url:         `/services/data/${SF_VER()}/sobjects/Invoice__c`,
        referenceId: 'Invoice',
        body: {
          Access_Key__c: _accessKey,
          Name:          _nNF,
        },
      },
      // 2) Lê a PO para obter o Name
      {
        method:      'GET',
        url:         `/services/data/${SF_VER()}/sobjects/Purchase_Order__c/${poId}`,
        referenceId: 'GetPO',
      },
      // 3) Vincula Invoice à PO
      {
        method:      'PATCH',
        url:         `/services/data/${SF_VER()}/sobjects/Invoice__c/@{Invoice.id}`,
        referenceId: 'InvoiceLinkPO',
        body: {
          Purchase_Order__c:         poId,
          Invoice_Purchase_Order__c: '@{GetPO.Name}',
        },
      },
      // 4) Bulk Invoice Line Items
      {
        method:      'POST',
        url:         `/services/data/${SF_VER()}/composite/sobjects`,
        referenceId: 'INVOICE_LI_BULK',
        body: { allOrNone: true, records: invLiRecords },
      },
    ],
  };

  const result = await sf.composite(compositeBody);

  const failed = result.compositeResponse.filter(r => r.httpStatusCode >= 400);
  if (failed.length) {
    throw Object.assign(
      new Error('Composite Invoice retornou erros'),
      { status: 422, failed, full: result.compositeResponse }
    );
  }

  const invoiceRef = result.compositeResponse.find(r => r.referenceId === 'Invoice');
  const invoiceLiRef = result.compositeResponse.find(r => r.referenceId === 'INVOICE_LI_BULK');

  return {
    invoiceId:      invoiceRef?.body?.id,
    accessKey:      _accessKey,
    nNF:            _nNF,
    invoiceLiCount: invoiceLiRef?.body?.length ?? 0,
  };
}

// ── ORQUESTRADOR PRINCIPAL ────────────────────────────────────
/**
 * Fluxo completo — espelha createPoWithPoli() do criacao_PO.js:
 *
 *  1. Resolve Account ID e Hub ID no SF
 *  2. Seleciona produtos (vendor ∩ estoque) aleatoriamente
 *  3. Cria Purchase_Order__c
 *  4. Enriquece detalhes dos produtos (Name, Barcode, Cost)
 *  5. Cria PO_Line_Item__c (um por produto, paralelo)
 *  6. Gera AccessKey com CNPJ do emitente (módulo 11 SEFAZ)
 *  7. Cria Invoice__c + vincula PO + cria Invoice_Line_Item__c
 *
 * @param {object} params
 * @param {string} params.vendorName
 * @param {string} params.cnpj            - CNPJ do emitente (14 dígitos)
 * @param {string} params.hubName
 * @param {string} [params.status]        - status inicial da PO (padrão: 'Open')
 * @param {number} [params.numeroProdutos]- quantidade de produtos (padrão: limit do .env)
 * @param {string} [params.uom]           - UOM (padrão: 'ea')
 *
 * @returns {Promise<{
 *   poId, invoiceId, accessKey, nNF,
 *   products: Array, poliIds: string[]
 * }>}
 */
async function createPoWithPoli({
  vendorName,
  cnpj,
  hubName,
  status         = 'Open',
  numeroProdutos = config.limitProdutos,
  uom            = config.uomDefault,
}) {
  console.log(`\n[po] ▶ Iniciando createPoWithPoli`);
  console.log(`     Vendor: ${vendorName} | Hub: ${hubName} | UOM: ${uom} | Qtd: ${numeroProdutos}`);

  // ── Step 1: Resolve Account e Hub IDs ──────────────────────
  const TAX_ID = cnpj.replace(/\D/g, '');

  const [accData, hubData] = await Promise.all([
    sf.query(`SELECT Id FROM Account WHERE Tax_Id__c='${TAX_ID}' AND Name='${vendorName}'`),
    sf.query(`SELECT Id FROM Hub__c WHERE Name='${hubName}' LIMIT 1`),
  ]);

  const accountId = accData.records?.[0]?.Id;
  const hubId     = hubData.records?.[0]?.Id;

  if (!accountId) throw Object.assign(new Error(`Account não encontrado: ${vendorName} / ${TAX_ID}`), { status: 404 });
  if (!hubId)     throw Object.assign(new Error(`Hub não encontrado: ${hubName}`), { status: 404 });

  console.log(`[po] ✓ Account: ${accountId} | Hub: ${hubId}`);

  // ── Step 2: Seleciona produtos (vendor ∩ estoque) ───────────
  console.log(`[po] Selecionando produtos compatíveis…`);
  const selectedProducts = await selectProductsPoli({ vendorName, hubName, numeroProdutos, uom });
  console.log(`[po] ✓ ${selectedProducts.length} produtos selecionados`);

  // ── Step 3: Cria Purchase Order ─────────────────────────────
  console.log(`[po] Criando Purchase Order…`);
  const poId = await createPO({ accountId, hubId, status });
  console.log(`[po] ✓ PO criada: ${poId}`);

  // ── Step 4: Enriquece detalhes dos produtos ─────────────────
  console.log(`[po] Enriquecendo detalhes dos produtos…`);
  const enrichedProducts = await enrichProductDetails(selectedProducts, vendorName, poId);
  console.log(`[po] ✓ ${enrichedProducts.length} produtos enriquecidos`);

  if (!enrichedProducts.length) {
    throw Object.assign(
      new Error('Nenhum produto retornou detalhes válidos do SF'),
      { status: 422 }
    );
  }

  // ── Step 5: Cria PO Line Items ──────────────────────────────
  console.log(`[po] Criando ${enrichedProducts.length} POLI…`);
  const poliIds = await createPOLI(poId, enrichedProducts);
  console.log(`[po] ✓ ${poliIds.length} POLIs criados`);

  // ── Step 6 + 7: Gera chave de acesso + cria Invoice ─────────
  console.log(`[po] Gerando chave de acesso e criando Invoice…`);
  const invoiceData = await createInvoice({ poId, cnpj, products: enrichedProducts });
  console.log(`[po] ✓ Invoice: ${invoiceData.invoiceId} | AccessKey: ${invoiceData.accessKey}`);

  // ── Resultado final ─────────────────────────────────────────
  const result = {
    poId,
    invoiceId:   invoiceData.invoiceId,
    accessKey:   invoiceData.accessKey,
    nNF:         invoiceData.nNF,
    poliIds,
    products: enrichedProducts.map(p => ({
      index:       p.index,
      productId:   p.Product__c,
      productName: p.productName,
      barcode:     p.barcode,
      qty:         p.qty,
      uom:         p.uom,
      lastCost:    p.lastCost,
      unitNetCost: p.unitNetCost,
      subtotal:    +(p.qty * p.lastCost).toFixed(2),
    })),
    summary: {
      vendorName,
      hubName,
      uom,
      totalProducts:  enrichedProducts.length,
      totalPoliIds:   poliIds.length,
      totalValue:     +enrichedProducts
                       .reduce((s, p) => s + p.qty * p.lastCost, 0)
                       .toFixed(2),
    },
  };

  console.log(`\n[po] ✅ Concluído:`);
  console.log(`     PO:      ${result.poId}`);
  console.log(`     Invoice: ${result.invoiceId}`);
  console.log(`     Produtos:${result.products.length} | Total: R$ ${result.summary.totalValue}`);
  console.log(`     AccessKey: ${result.accessKey}\n`);

  return result;
}

module.exports = {
  createPoWithPoli,
  createPO,
  createPOLI,
  createInvoice,
  selectProductsPoli,
};
