// ============================================================
//  apps/management-test/server/routes/rops.routes.js
//  Rotas /api/rops — Rider Operations (Deliveries)
// ============================================================
'use strict';

const express          = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const axios            = require('axios');
const sf               = require('../../../../packages/salesforce/index');

const router = express.Router();

const RopsAddress = require('../models/RopsAddress');
const RopsScenario = require('../models/RopsScenario');
const hubService = require('../services/hub.service');

// ── ENDEREÇOS ───────────────────────────────────────────────
// GET /api/rops/addresses
router.get('/addresses', asyncHandler(async (req, res) => {
  const addresses = await RopsAddress.find().sort({ createdAt: -1 });
  res.json(addresses);
}));

// POST /api/rops/addresses
router.post('/addresses', asyncHandler(async (req, res) => {
  const { id } = req.body;
  const address = await RopsAddress.findOneAndUpdate(
    { id },
    req.body,
    { upsert: true, new: true }
  );
  res.json(address);
}));

// DELETE /api/rops/addresses/:id
router.delete('/addresses/:id', asyncHandler(async (req, res) => {
  await RopsAddress.deleteOne({ id: req.params.id });
  res.json({ success: true });
}));

// ── CENÁRIOS ────────────────────────────────────────────────
// GET /api/rops/scenarios
router.get('/scenarios', asyncHandler(async (req, res) => {
  const scenarios = await RopsScenario.find().sort({ createdAt: -1 });
  res.json(scenarios);
}));

// POST /api/rops/scenarios
router.post('/scenarios', asyncHandler(async (req, res) => {
  const { id } = req.body;
  const scenario = await RopsScenario.findOneAndUpdate(
    { id },
    { ...req.body, updated_at: new Date() },
    { upsert: true, new: true }
  );
  res.json(scenario);
}));

// DELETE /api/rops/scenarios/:id
router.delete('/scenarios/:id', asyncHandler(async (req, res) => {
  await RopsScenario.deleteOne({ id: req.params.id });
  res.json({ success: true });
}));

// ── HUB PRODUCTS ────────────────────────────────────────────
// GET /api/rops/hub-products?hubName=SAO043
// Lista produtos do Hub via Hub_Inventory__c (Cache-First)
router.get('/hub-products', asyncHandler(async (req, res) => {
  const { hubName, forceSync } = req.query;
  if (!hubName) {
    return res.status(400).json({ error: 'hubName obrigatório' });
  }

  try {
    const products = await hubService.getHubProducts(hubName, forceSync === 'true');
    
    // Formata para o formato que o frontend espera (rops.js)
    const formatted = products.map(p => ({
      salesforce_id: p.salesforce_id,
      sku:           p.sku,
      name:          p.name,
      description:   p.name,
      barcode:       p.barcode,
      location:      p.location,
      image_url:     '', 
      price:         p.price,
    }));

    res.json({ hubName, total: formatted.length, products: formatted });
  } catch (err) {
    console.error('[ROPS] Hub products error:', err.message);
    res.status(500).json({ error: err.message, products: [] });
  }
}));

// GET /api/rops/product-by-sku?hubName=SAO022&sku=150304009
// Busca produto específico no Hub via SKU (Cache-First)
router.get('/product-by-sku', asyncHandler(async (req, res) => {
  const { hubName, sku, forceSync } = req.query;
  if (!hubName || !sku) {
    return res.status(400).json({ error: 'hubName e sku obrigatórios', found: false });
  }

  try {
    const p = await hubService.getProductBySku(hubName, sku, forceSync === 'true');
    if (!p) {
      return res.json({ found: false, hubName, sku });
    }

    res.json({
      found:         true,
      salesforce_id: p.salesforce_id,
      sku:           p.sku,
      name:          p.name,
      description:   p.name,
      barcode:       p.barcode,
      location:      p.location,
      image_url:     '',
      price:         p.price,
    });
  } catch (err) {
    console.error('[ROPS] SKU lookup error:', err.message);
    res.json({ found: false, hubName, sku, error: err.message });
  }
}));

// POST /api/rops/deliveries — Cria delivery na API Ice Cream
router.post('/deliveries', asyncHandler(async (req, res) => {
  const apiUrl = process.env.ROPS_API_URL;
  const apiKey = process.env.ROPS_API_KEY;

  if (!apiUrl || !apiKey) {
    return res.status(500).json({
      error: 'ROPS_API_URL ou ROPS_API_KEY não configurados no .env',
    });
  }

  const { delivery } = req.body;
  if (!delivery) {
    return res.status(400).json({ error: 'Payload "delivery" obrigatório' });
  }

  try {
    const response = await axios.post(
      apiUrl,
      { delivery },
      {
        headers: {
          'jokr-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        maxBodyLength: Infinity,
      }
    );

    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data   = err.response?.data   || { error: err.message };
    console.error('[ROPS] Erro ao criar delivery:', status, data);
    res.status(status).json(data);
  }
}));

// PUT /api/rops/deliveries/pick — Atualiza delivery para Pick
router.put('/deliveries/pick', asyncHandler(async (req, res) => {
  const apiUrl = process.env.ROPS_API_URL;
  const apiKey = process.env.ROPS_API_KEY;

  if (!apiUrl || !apiKey) {
    return res.status(500).json({ error: 'ROPS_API_URL ou ROPS_API_KEY não configurados no .env' });
  }

  const { delivery } = req.body;
  if (!delivery) {
    return res.status(400).json({ error: 'Payload "delivery" obrigatório' });
  }

  try {
    // URL de pick é /pick no mesmo base path
    const pickUrl = apiUrl.replace(/\/deliveries\/?$/, '/deliveries/pick');
    const response = await axios.put(
      pickUrl,
      { delivery },
      {
        headers: { 'jokr-api-key': apiKey, 'Content-Type': 'application/json' },
        maxBodyLength: Infinity,
      }
    );
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data   = err.response?.data   || { error: err.message };
    console.error('[ROPS] Erro ao fazer pick:', status, data);
    res.status(status).json(data);
  }
}));

// PUT /api/rops/deliveries/cancel — Cancela delivery
router.put('/deliveries/cancel', asyncHandler(async (req, res) => {
  const apiUrl = process.env.ROPS_API_URL;
  const apiKey = process.env.ROPS_API_KEY;

  if (!apiUrl || !apiKey) {
    return res.status(500).json({ error: 'ROPS_API_URL ou ROPS_API_KEY não configurados no .env' });
  }

  const { delivery } = req.body;
  if (!delivery) {
    return res.status(400).json({ error: 'Payload "delivery" obrigatório' });
  }

  try {
    const cancelUrl = apiUrl.replace(/\/deliveries\/?$/, '/deliveries/cancel');
    const response = await axios.put(
      cancelUrl,
      { delivery },
      {
        headers: { 'jokr-api-key': apiKey, 'Content-Type': 'application/json' },
        maxBodyLength: Infinity,
      }
    );
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data   = err.response?.data   || { error: err.message };
    console.error('[ROPS] Erro ao cancelar delivery:', status, data);
    res.status(status).json(data);
  }
}));

// PUT /api/rops/deliveries/ready — Marca delivery como Ready
router.put('/deliveries/ready', asyncHandler(async (req, res) => {
  const apiUrl = process.env.ROPS_API_URL;
  const apiKey = process.env.ROPS_API_KEY;

  if (!apiUrl || !apiKey) {
    return res.status(500).json({ error: 'ROPS_API_URL ou ROPS_API_KEY não configurados no .env' });
  }

  const { delivery } = req.body;
  if (!delivery) {
    return res.status(400).json({ error: 'Payload "delivery" obrigatório' });
  }

  try {
    const readyUrl = apiUrl.replace(/\/deliveries\/?$/, '/deliveries/ready');
    const response = await axios.put(
      readyUrl,
      { delivery },
      {
        headers: { 'jokr-api-key': apiKey, 'Content-Type': 'application/json' },
        maxBodyLength: Infinity,
      }
    );
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data   = err.response?.data   || { error: err.message };
    console.error('[ROPS] Erro ao marcar como ready:', status, data);
    res.status(status).json(data);
  }
}));

module.exports = router;
