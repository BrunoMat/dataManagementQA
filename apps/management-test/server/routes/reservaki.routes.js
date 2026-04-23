// ============================================================
//  apps/management-test/server/routes/reservaki.routes.js
//  Rotas /api/reservaki — Shifts, Slots, Divulgation
// ============================================================
'use strict';

const express          = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const axios            = require('axios');

const router = express.Router();

const RSV_API    = 'https://api-stg.soudaki.com/reservaki/api/v1';
const ZEUS_GQL   = 'https://api-stg.soudaki.com/zeus/graphql';
const ZEUS_TOKEN = 'Bearer 075847031c421ffb44a2cece74ebb63a';

function zeusHeaders() {
  return { 'Content-Type': 'application/json', Authorization: ZEUS_TOKEN };
}

// POST /api/reservaki/shifts — Cria um turno
router.post('/shifts', asyncHandler(async (req, res) => {
  const { name, start_time, end_time, created_by_email } = req.body;
  try {
    const r = await axios.post(`${RSV_API}/shifts`, {
      name, start_time, end_time, created_by_email,
    }, { headers: { 'Content-Type': 'application/json' } });
    res.json({ ok: true, data: r.data });
  } catch (err) {
    const status = err.response?.status || 500;
    const data   = err.response?.data || { error: err.message };
    res.status(status).json(data);
  }
}));

// GET /api/reservaki/shifts — Lista turnos
router.get('/shifts', asyncHandler(async (req, res) => {
  try {
    const r = await axios.get(`${RSV_API}/shifts`);
    res.json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message });
  }
}));

// POST /api/reservaki/slots — Upload CSV de vagas via GraphQL Zeus
router.post('/slots', asyncHandler(async (req, res) => {
  const { csvBase64, fileSize, createdBy } = req.body;

  const query = `
    mutation UploadAndProcessSlots(
      $scope: String!, $contentType: String!, $fileBase64: String!,
      $fileName: String!, $fileSize: Int!, $createdBy: String!
    ) {
      uploadFileToCloud(scope: $scope, contentType: $contentType, fileBase64: $fileBase64, fileName: $fileName, size: $fileSize) {
        scope __typename
      }
      processMassiveSlotsFile(scope: $scope, createdBy: $createdBy)
    }`;

  try {
    const r = await axios.post(ZEUS_GQL, {
      query,
      variables: {
        scope: 'slots', contentType: 'text/csv',
        fileBase64: csvBase64, fileName: 'slot.csv',
        fileSize: fileSize, createdBy: createdBy || 'automations@soudaki.com',
      },
    }, { headers: zeusHeaders() });
    res.json({ ok: true, data: r.data });
  } catch (err) {
    const data = err.response?.data || { error: err.message };
    res.status(err.response?.status || 500).json(data);
  }
}));

// POST /api/reservaki/divulgation — Upload CSV de divulgação via GraphQL Zeus
router.post('/divulgation', asyncHandler(async (req, res) => {
  const { csvBase64, fileSize, createdBy } = req.body;

  const query = `
    mutation UploadAndProcessDivulgation(
      $scope: String!, $contentType: String!, $fileBase64: String!,
      $fileName: String!, $fileSize: Int!, $createdBy: String!
    ) {
      uploadFileToCloud(scope: $scope, contentType: $contentType, fileBase64: $fileBase64, fileName: $fileName, size: $fileSize) {
        url name path contentType size
      }
      processDivulgationPlanningFile(scope: $scope, createdBy: $createdBy)
    }`;

  try {
    const r = await axios.post(ZEUS_GQL, {
      query,
      variables: {
        scope: 'divulgation', contentType: 'text/csv',
        fileBase64: csvBase64, fileName: 'divulgationPlanning.csv',
        fileSize: fileSize, createdBy: createdBy || 'automations@soudaki.com',
      },
    }, { headers: zeusHeaders() });
    res.json({ ok: true, data: r.data });
  } catch (err) {
    const data = err.response?.data || { error: err.message };
    res.status(err.response?.status || 500).json(data);
  }
}));

// POST /api/reservaki/divulgate — Executa divulgação de um planning
router.post('/divulgate', asyncHandler(async (req, res) => {
  const { id, createdBy } = req.body;

  const query = `
    mutation ReservakiModule_SlotModule_DivulgatePlanning($id: Int!, $createdBy: String!) {
      divulgatePlanning(id: $id, createdBy: $createdBy)
    }`;

  try {
    const r = await axios.post(ZEUS_GQL, {
      query,
      variables: { id, createdBy: createdBy || 'automations@soudaki.com' },
    }, { headers: zeusHeaders() });
    res.json({ ok: true, data: r.data });
  } catch (err) {
    const data = err.response?.data || { error: err.message };
    res.status(err.response?.status || 500).json(data);
  }
}));

module.exports = router;
