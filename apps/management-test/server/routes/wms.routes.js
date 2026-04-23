// ============================================================
//  wms.routes.js — Proxy para INVR (Midgard) REST API
// ============================================================
'use strict';
const express          = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const axios            = require('axios');
const router           = express.Router();

const INVR_HOST = process.env.INVR_API_URL || 'https://api-stg.soudaki.com/invr';

function fwd(method, path) {
  return asyncHandler(async (req, res) => {
    const url = `${req.body._host || INVR_HOST}${path}`;
    const body = { ...req.body };
    delete body._host;
    try {
      const r = await axios({ method, url, data: method !== 'get' ? body : undefined, headers: { 'Content-Type': 'application/json' } });
      res.json(r.data);
    } catch (err) {
      const status = err.response?.status || 500;
      const data   = err.response?.data || { error: err.message };
      console.error(`[WMS] ${method.toUpperCase()} ${path}:`, status);
      res.status(status).json(data);
    }
  });
}

// POST /api/wms/inventories/search
router.post('/inventories/search', asyncHandler(async (req, res) => {
  const { hub, skus, host } = req.body;
  const url = `${host || INVR_HOST}/api/v2/inventories/search`;
  try {
    const r = await axios.post(url, { externalWarehouseId: hub, skus }, { headers: { 'Content-Type': 'application/json' } });
    res.json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
}));

// POST /api/wms/locations
router.post('/locations', asyncHandler(async (req, res) => {
  const { hub, name, area, host } = req.body;
  const url = `${host || INVR_HOST}/api/v2/locations`;
  try {
    const r = await axios.post(url, { warehouse_external_id: hub, name, area }, { headers: { 'Content-Type': 'application/json' } });
    res.json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
}));

// POST /api/wms/warehouse-products
router.post('/warehouse-products', asyncHandler(async (req, res) => {
  const { hub, sku, host } = req.body;
  const url = `${host || INVR_HOST}/api/v2/warehouse-products`;
  try {
    const r = await axios.post(url, { warehouse_external_id: hub, sku }, { headers: { 'Content-Type': 'application/json' } });
    res.json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
}));

// POST /api/wms/movements — create open or fulfilled
router.post('/movements', asyncHandler(async (req, res) => {
  const { type, hub, kind, source, referenceKind, sku, qty, location, host } = req.body;
  const endpoint = type === 'fulfilled' ? '/api/v2/movements/fulfilled' : '/api/v2/movements/open';
  const url = `${host || INVR_HOST}${endpoint}`;

  const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });

  const lineItem = {
    id: uuid(),
    sku,
    amount: qty,
    ...(type === 'fulfilled' ? { destination_location_name: location || 'A-1-1-1', destination_state: 'available' } : {}),
  };

  const payload = {
    warehouse_external_id: hub,
    kind: kind || 'outbound',
    source: source || 'system',
    reference: { id: uuid(), kind: referenceKind || 'delivery', data: {} },
    line_items: [lineItem],
  };

  try {
    const r = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
    res.json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
}));

// POST /api/wms/movements/fulfill
router.post('/movements/fulfill', asyncHandler(async (req, res) => {
  const { movementId, lineItemId, qty, location, state, host } = req.body;
  const url = `${host || INVR_HOST}/api/v2/movements/${movementId}/fulfill`;
  const payload = { line_items: [{ id: lineItemId, amount: qty, destination_location_name: location, destination_state: state || 'available' }] };
  try {
    const r = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
    res.json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
}));

// POST /api/wms/movements/cancel
router.post('/movements/cancel', asyncHandler(async (req, res) => {
  const { movementId, host } = req.body;
  const url = `${host || INVR_HOST}/api/v2/movements/${movementId}/cancel`;
  try {
    const r = await axios.post(url, {}, { headers: { 'Content-Type': 'application/json' } });
    res.json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
}));

module.exports = router;
