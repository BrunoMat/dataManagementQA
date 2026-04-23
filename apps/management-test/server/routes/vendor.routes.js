// ============================================================
//  apps/management-test/server/routes/vendor.routes.js
//  Rotas /api/vendors
// ============================================================
'use strict';

const express          = require('express');
const vendorService    = require('../services/vendor.service');
const inventoryService = require('../services/inventory.service');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/vendors/by-hub?hubId=hub-123&hubName=SAO903&uom=ea
router.get('/by-hub', asyncHandler(async (req, res) => {
  const { hubId, hubName, uom } = req.query;
  if (!hubId && !hubName) return res.status(400).json({ error: 'hubId ou hubName obrigatório' });
  const result = await vendorService.getVendorsByHub({ hubId, hubName, uom });
  res.json(result);
}));

// ── GET /api/vendors/products ─────────────────────────────
//  Busca produtos por sfAccountId (direto, sem lookup por CNPJ)
//  ou por cnpj+cnpjName (fallback).
//  Query: ?sfAccountId=0015g00...&uom=ea&limit=200
//      ou ?cnpj=01838723009850&cnpjName=BRF+SP&uom=ea
router.get('/products', asyncHandler(async (req, res) => {
  const { sfAccountId, cnpj, cnpjName, uom, limit } = req.query;
  const result = await vendorService.getVendorProducts({
    sfAccountId,
    cnpj,
    cnpjName,
    uom,
    limit,
  });
  res.json(result);
}));

// ── POST /api/vendors/sync ────────────────────────────────
//  Sincroniza produtos de um vendor para todos os UOMs
//  solicitados. Retorna o catálogo completo para o frontend
//  salvar no IndexedDB.
//
//  Body: { sfAccountId, vendorName, uoms: ['ea','Pallet',...] }
//  Resposta: { vendor, syncedUoms: [{ uom, count, products[] }] }
router.post('/sync', asyncHandler(async (req, res) => {
  const { sfAccountId, vendorName, cnpj, uoms } = req.body;

  if (!sfAccountId && !cnpj) {
    return res.status(400).json({ error: 'sfAccountId ou cnpj obrigatório' });
  }
  if (!Array.isArray(uoms) || uoms.length === 0) {
    return res.status(400).json({ error: 'uoms deve ser array não vazio' });
  }

  const config = require('../config/sf.config');
  const limit  = config.limitProdutos; // if undefined => no limit

  // Busca todos os UOMs em paralelo
  const results = await Promise.all(
    uoms.map(async (uom) => {
      try {
        const data = await vendorService.getVendorProducts({
          sfAccountId,
          cnpj,
          cnpjName: vendorName,
          uom,
          limit,
          forceSync: true,
        });
        return { uom, count: data.total, products: data.products, error: null };
      } catch (err) {
        console.error(`[sync] Erro UOM ${uom}:`, err.message);
        return { uom, count: 0, products: [], error: err.message };
      }
    })
  );

  res.json({
    vendor: { sfAccountId, vendorName },
    syncedUoms: results,
    totalProducts: results.reduce((s, r) => s + r.count, 0),
    products: results[0]?.products || [], // Retorna o primeiro UOM (geralmente 'ea') para update rápido
    syncedAt: new Date().toISOString(),
  });
}));

// GET /api/vendors/compatible?sfAccountId=...&hubName=SAO903&uom=ea
router.get('/compatible', asyncHandler(async (req, res) => {
  const { sfAccountId, vendorName, hubName, uom = 'ea' } = req.query;
  if ((!sfAccountId && !vendorName) || !hubName) {
    return res.status(400).json({ error: 'sfAccountId (ou vendorName) e hubName obrigatórios' });
  }

  let vendorIds = [];
  let stockIds  = [];

  try {
    [vendorIds, stockIds] = await Promise.all([
      vendorService.getProductIdsByVendor(sfAccountId || vendorName, uom, !!sfAccountId),
      inventoryService.getProductsInStock(hubName),
    ]);
  } catch (err) {
    console.warn(`[compatible] Erro ao buscar dados: ${err.message}`);
    // Retorna lista vazia em vez de erro — o frontend decide se filtra ou não
    return res.json({ sfAccountId, vendorName, hubName, uom, total: 0, productIds: [] });
  }

  // Se estoque está vazio, retorna lista vazia (frontend mostrará todos os produtos)
  if (!stockIds.length) {
    return res.json({ sfAccountId, vendorName, hubName, uom, total: 0, productIds: [] });
  }

  const stockSet   = new Set(stockIds);
  const compatible = vendorIds.filter(id => stockSet.has(id));
  res.json({ sfAccountId, vendorName, hubName, uom, total: compatible.length, productIds: compatible });
}));

// GET /api/vendors
router.get('/', asyncHandler(async (req, res) => {
  const Vendor = require('../models/Vendor');
  const vendors = await Vendor.find({}); // Mostra todos para gerenciamento
  res.json(vendors);
}));

// POST /api/vendors
router.post('/', asyncHandler(async (req, res) => {
  const Vendor = require('../models/Vendor');
  const { id, name, cnpj, sf_account_id, active } = req.body;
  
  if (!id) return res.status(400).json({ error: 'ID local (id) é obrigatório' });

  // Prioriza o filtro por ID local (o que o frontend envia),
  // fallback para sf_account_id ou cnpj para evitar duplicidade de dados Salesforce
  const filter = { id };
  
  const updateData = {
    id,
    name,
    cnpj: (cnpj || '').replace(/\D/g, ''),
    sf_account_id,
    active: active !== false
  };

  const vendor = await Vendor.findOneAndUpdate(
    filter,
    { $set: updateData },
    { upsert: true, new: true }
  );
  
  res.status(201).json(vendor);
}));

// POST /api/vendors/link-hub
router.post('/link-hub', asyncHandler(async (req, res) => {
  const HubVendor = require('../models/HubVendor');
  const vendorService = require('../services/vendor.service');
  const { hubId, vendorId, sfAccountId } = req.body;
  
  if (!hubId || !vendorId) return res.status(400).json({ error: 'hubId and vendorId required' });

  // Cria o vínculo no MongoDB
  await HubVendor.findOneAndUpdate(
    { hub_id: hubId, vendor_id: vendorId },
    { active: true },
    { upsert: true, new: true }
  );

  // Dispara sincronização em background para popular o cache de produtos
  // Se sfAccountId não for passado, o service tentará resolver pelo DB ou SF
  vendorService.getVendorProducts({ 
    sfAccountId: sfAccountId || vendorId, 
    forceSync: false 
  }).catch(err => console.error('[Auto-Sync] Erro ao cachear produtos:', err.message));

  res.json({ success: true, message: 'Vínculo persistido e cache iniciado.' });
}));

// DELETE /api/vendors/unlink-hub
router.post('/unlink-hub', asyncHandler(async (req, res) => {
  const HubVendor = require('../models/HubVendor');
  const { hubId, vendorId } = req.body;
  await HubVendor.deleteOne({ hub_id: hubId, vendor_id: vendorId });
  res.json({ success: true });
}));

// DELETE /api/vendors/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const Vendor = require('../models/Vendor');
  const HubVendor = require('../models/HubVendor');
  const vendorId = req.params.id;

  console.log(`[DELETE] Removendo vendor e vínculos: ${vendorId}`);

  // 1. Remove todos os vínculos deste vendor com hubs
  const linksDeleted = await HubVendor.deleteMany({ vendor_id: vendorId });
  console.log(`[DELETE] Vínculos removidos: ${linksDeleted.deletedCount}`);

  // 2. Remove o vendor
  const result = await Vendor.deleteOne({ id: vendorId });
  console.log(`[DELETE] Vendor removido: ${result.deletedCount}`);

  res.status(204).end();
}));

module.exports = router;
