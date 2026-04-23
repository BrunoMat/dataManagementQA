// ============================================================
//  apps/management-test/server/routes/po.routes.js — Rotas /api/po
// ============================================================
'use strict';

const express          = require('express');
const poService        = require('../services/po.service');
const nfkeyService     = require('../services/nfkey.service');
const vendorService    = require('../services/vendor.service');
const sf               = require('../../../../packages/salesforce/index');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// ── POST /api/po/create ───────────────────────────────────
//  Cria PO + POLIs + Invoice no Salesforce.
//  Usa sfAccountId e hubId diretamente (sem lookup extra).
//
//  Body: {
//    sfAccountId,   // ID do Account no SF — obrigatório
//    hubName,       // nome do HUB (para buscar hubId)
//    cnpj,          // para gerar AccessKey
//    vendorName,    // para logs
//    uom,
//    nNF, accessKey,
//    products: [{ productId, sku, barcode, qty, last_cost, uom }]
//  }
router.post('/create', asyncHandler(async (req, res) => {
  const {
    sfAccountId,
    hubName,
    cnpj,
    vendorName,
    uom     = 'ea',
    nNF,
    accessKey,
    products,
  } = req.body;

  if (!sfAccountId)      return res.status(400).json({ error: 'sfAccountId obrigatório' });
  if (!hubName)          return res.status(400).json({ error: 'hubName obrigatório' });
  if (!products?.length) return res.status(400).json({ error: 'products[] obrigatório' });

  // Resolve Hub ID no SF
  const hubData = await sf.query(`SELECT Id FROM Hub__c WHERE Name='${hubName}' LIMIT 1`);
  const hubId   = hubData.records?.[0]?.Id;
  if (!hubId) return res.status(404).json({ error: `Hub '${hubName}' não encontrado no SF` });

  // Cria PO com sfAccountId direto (sem lookup por CNPJ)
  const poId = await poService.createPO({ accountId: sfAccountId, hubId, status: 'Open' });

  // Monta enrichedProducts com os dados do frontend
  const enriched = products.map((p, i) => ({
    index:       i + 1,
    Product__c:  p.productId,
    productName: p.desc || '',
    barcode:     p.barcode || '',
    qty:         p.qty,
    uom:         p.uom || uom,
    lastCost:    p.last_cost,
    unitNetCost: 1,
    poId,
  }));

  // Cria POLIs
  const poliIds = await poService.createPOLI(poId, enriched);

  // Gera Invoice com AccessKey já calculada no frontend
  const invoiceData = await poService.createInvoice({ poId, cnpj, products: enriched, nNF, accessKey });

  res.status(201).json({
    ok:        true,
    poId,
    invoiceId: invoiceData.invoiceId,
    accessKey: invoiceData.accessKey,
    nNF:       invoiceData.nNF,
    poliIds,
    poliCount: poliIds.length,
  });
}));

// ── POST /api/po/create-only ─────────────────────────────
// Cria PO + POLIs no Salesforce, sem gerar Invoice.
router.post('/create-only', asyncHandler(async (req, res) => {
  const {
    sfAccountId,
    hubName,
    vendorName,
    uom = 'ea',
    products,
  } = req.body;

  if (!sfAccountId)      return res.status(400).json({ error: 'sfAccountId obrigatório' });
  if (!hubName)          return res.status(400).json({ error: 'hubName obrigatório' });
  if (!products?.length) return res.status(400).json({ error: 'products[] obrigatório' });

  // Resolve Hub ID no SF
  const hubData = await sf.query(`SELECT Id FROM Hub__c WHERE Name='${hubName}' LIMIT 1`);
  const hubId   = hubData.records?.[0]?.Id;
  if (!hubId) return res.status(404).json({ error: `Hub '${hubName}' não encontrado no SF` });

  // Cria PO com sfAccountId direto (sem lookup por CNPJ)
  const poId = await poService.createPO({ accountId: sfAccountId, hubId, status: 'Open' });

  // Monta enrichedProducts com os dados do frontend
  const enriched = products.map((p, i) => ({
    index:       i + 1,
    Product__c:  p.productId,
    productName: p.desc || '',
    barcode:     p.barcode || '',
    qty:         p.qty,
    uom:         p.uom || uom,
    lastCost:    p.last_cost,
    unitNetCost: 1,
    poId,
  }));

  // Cria POLIs
  const poliIds = await poService.createPOLI(poId, enriched);

  // Retorna formato compatível com /api/po/create — Invoice não criada
  res.status(201).json({
    ok: true,
    poId,
    invoiceId: null,
    accessKey: null,
    nNF: null,
    poliIds,
    poliCount: poliIds.length,
  });
}));

// ── POST /api/po/create-full ──────────────────────────────
//  Fluxo automático (sem seleção manual): busca produtos,
//  intersecta com estoque, cria PO+POLI+Invoice.
router.post('/create-full', asyncHandler(async (req, res) => {
  const {
    sfAccountId, vendorName, cnpj, hubName,
    status = 'Open',
    uom = process.env.SF_UOM_DEFAULT || 'ea',
  } = req.body;

  // numeroProdutos is optional: if provided in body use it, otherwise use config value (may be undefined)
  const config = require('../config/sf.config');
  const numeroProdutos = req.body.numeroProdutos !== undefined
    ? Number(req.body.numeroProdutos)
    : config.limitProdutos;

  if (!vendorName || !cnpj || !hubName) {
    return res.status(400).json({ error: 'vendorName, cnpj e hubName obrigatórios' });
  }

  const result = await poService.createPoWithPoli({
    sfAccountId, vendorName, cnpj, hubName,
    status, numeroProdutos: Number(numeroProdutos), uom,
  });

  res.status(201).json(result);
}));

// ── GET /api/po/preview-key?cnpj=...&cuf=35 ──────────────
router.get('/preview-key', asyncHandler(async (req, res) => {
  const { cnpj, cuf } = req.query;
  if (!cnpj) return res.status(400).json({ error: 'cnpj obrigatório' });
  res.json(nfkeyService.generateAccessKey({ cnpj, cUF: cuf || '35' }));
}));

module.exports = router;
