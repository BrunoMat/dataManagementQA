// ============================================================
//  apps/management-test/server/routes/to.routes.js
//  Rotas /api/to — Transfer Order
// ============================================================
'use strict';

const express          = require('express');
const toService        = require('../services/to.service');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// ── GET /api/to/cross-inventory?cd=SAO903&hub=SAO022 ─────────
//  Retorna produtos que existem tanto no CD quanto no HUB.
router.get('/cross-inventory', asyncHandler(async (req, res) => {
  const { cd, hub } = req.query;
  if (!cd)  return res.status(400).json({ error: 'cd obrigatório (ex: SAO903)' });
  if (!hub) return res.status(400).json({ error: 'hub obrigatório (ex: SAO022)' });

  const result = await toService.getCrossInventory(cd, hub);
  res.json(result);
}));

// ── POST /api/to/create ──────────────────────────────────────
//  Cria Transfer Order + TOLIs no Salesforce.
//
//  Body: {
//    cdName:   "SAO903",
//    hubName:  "SAO022",
//    products: [{ productId, qty, fromHubProduct, toHubProduct,
//                 fromInventoryId, toInventoryId, fromLocation }]
//  }
router.post('/create', asyncHandler(async (req, res) => {
  const { cdName, hubName, products } = req.body;

  if (!cdName)          return res.status(400).json({ error: 'cdName obrigatório' });
  if (!hubName)         return res.status(400).json({ error: 'hubName obrigatório' });
  if (!products?.length) return res.status(400).json({ error: 'products[] obrigatório' });

  const result = await toService.createFullTO({ cdName, hubName, products });

  res.status(201).json({
    ok: true,
    ...result,
  });
}));

module.exports = router;
