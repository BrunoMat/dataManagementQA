// ============================================================
//  hubr.routes.js — Proxy para HUBR GraphQL
// ============================================================
'use strict';
const express          = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const axios            = require('axios');
const router           = express.Router();

const DEFAULT_HUBR_URL   = process.env.HUBR_API_URL || 'https://api-stg.soudaki.com/hubr-stg/graphql';
const DEFAULT_HUBR_TOKEN = process.env.HUBR_API_TOKEN || '075847031c421ffb44a2cece74ebb63a';

// IceCream API for kanban management
const ICECREAM_BASE = 'https://api-stg.soudaki.com/icecream/api/riders';
const ICECREAM_KEY  = process.env.ROPS_API_KEY || 'D&&Ma6D2KESF7j5h';

// POST /api/hubr/graphql — proxy genérico, aceita _url e _token opcionais
router.post('/graphql', asyncHandler(async (req, res) => {
  const { query, variables, operationName, _url, _token } = req.body;
  const url   = _url   || DEFAULT_HUBR_URL;
  const token = _token || DEFAULT_HUBR_TOKEN;

  try {
    const r = await axios.post(url, { query, variables, operationName }, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    res.json(r.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data   = err.response?.data || { error: err.message };
    console.error('[HUBR] GraphQL error:', status, url);
    res.status(status).json(data);
  }
}));

// POST /api/hubr/clear-kanban — limpa todas as deliveries de um hub
router.post('/clear-kanban', asyncHandler(async (req, res) => {
  const { hubId } = req.body;
  try {
    const r = await axios.post(
      `${ICECREAM_BASE}/qa/deliveries/cancel_all`,
      { hub_id: hubId },
      { headers: { 'Content-Type': 'application/json', 'qa-api-key': 'QA123' } }
    );
    res.json({ ok: true, data: r.data });
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
}));

module.exports = router;
