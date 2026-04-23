// ============================================================
//  apps/management-test/server/routes/sf.routes.js
//  Rotas /api/sf — conectividade e metadados Salesforce.
// ============================================================
'use strict';

const express             = require('express');
const sf                  = require('../../../../packages/salesforce/index');
const { asyncHandler }    = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/sf/ping — testa conectividade
router.get('/ping', asyncHandler(async (req, res) => {
  const result = await sf.ping();
  res.json(result);
}));

module.exports = router;
