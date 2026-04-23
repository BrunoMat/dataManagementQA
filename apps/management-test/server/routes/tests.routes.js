// ============================================================
//  apps/management-test/server/routes/tests.routes.js
//  Rotas /api/tests — GitHub Actions workflow dispatch & status
// ============================================================
'use strict';

const express          = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const axios            = require('axios');

const router = express.Router();

const GH_OWNER = 'JOKR-Services';
const GH_REPO  = 'maestro_test';
const GH_API   = 'https://api.github.com';

const WORKFLOWS = {
  raio_regressivo: 'raio_regressivo.yml',
  raio_smoke:      'raio_smoke.yml',
};

function ghHeaders() {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error('GH_TOKEN não configurado no .env');
  return {
    Authorization:  `token ${token}`,
    Accept:         'application/vnd.github.v3+json',
  };
}

// POST /api/tests/trigger — Dispatcha um workflow
// Body: { workflow: 'raio_regressivo' | 'raio_smoke', actor?: 'bruno-qa-daki' }
router.post('/trigger', asyncHandler(async (req, res) => {
  const { workflow, actor } = req.body;
  const file = WORKFLOWS[workflow];
  if (!file) {
    return res.status(400).json({ error: `Workflow inválido: ${workflow}. Opções: ${Object.keys(WORKFLOWS).join(', ')}` });
  }

  const ghActor = actor || process.env.GH_ACTOR || 'bruno-qa-daki';

  try {
    // Marca o timestamp ANTES do dispatch para identificar o novo run
    const dispatchedAt = new Date().toISOString();

    // 1. Dispatch the workflow
    await axios.post(
      `${GH_API}/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${file}/dispatches`,
      { ref: 'main', inputs: { username: ghActor, branch: 'main' } },
      { headers: ghHeaders() }
    );

    // 2. Polling até encontrar o run NOVO (created_at >= dispatchedAt)
    //    Tenta até 5 vezes com intervalo de 3s
    let latestRun = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise(r => setTimeout(r, 3000));

      const runsRes = await axios.get(
        `${GH_API}/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${file}/runs?per_page=5&branch=main`,
        { headers: ghHeaders() }
      );

      const runs = runsRes.data.workflow_runs || [];
      // Procura um run criado DEPOIS do dispatch
      const newRun = runs.find(r => new Date(r.created_at) >= new Date(dispatchedAt));
      if (newRun) {
        latestRun = newRun;
        break;
      }
      // Se não encontrou mas tem runs, pega o mais recente como fallback na última tentativa
      if (attempt === 4 && runs.length > 0) {
        latestRun = runs[0];
      }
    }

    res.json({
      ok: true,
      workflow,
      file,
      actor: ghActor,
      dispatched_at: new Date().toISOString(),
      run: latestRun ? {
        id:          latestRun.id,
        status:      latestRun.status,
        conclusion:  latestRun.conclusion,
        html_url:    latestRun.html_url,
        created_at:  latestRun.created_at,
        updated_at:  latestRun.updated_at,
      } : null,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const data   = err.response?.data   || { message: err.message };
    console.error('[Tests] Erro ao disparar workflow:', status, JSON.stringify(data, null, 2));
    console.error('[Tests] Request URL:', `${GH_API}/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${file}/dispatches`);
    res.status(status).json({ error: data.message || err.message });
  }
}));

// GET /api/tests/status?workflow=raio_regressivo
// Retorna o status do último run do workflow
router.get('/status', asyncHandler(async (req, res) => {
  const { workflow, runId } = req.query;
  const file = WORKFLOWS[workflow];
  if (!file && !runId) {
    return res.status(400).json({ error: 'workflow ou runId obrigatório' });
  }

  try {
    let run;

    if (runId) {
      // Fetch specific run
      const runRes = await axios.get(
        `${GH_API}/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${runId}`,
        { headers: ghHeaders() }
      );
      run = runRes.data;
    } else {
      // Fetch latest run for workflow
      const runsRes = await axios.get(
        `${GH_API}/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${file}/runs?per_page=1&branch=main`,
        { headers: ghHeaders() }
      );
      run = runsRes.data.workflow_runs?.[0] || null;
    }

    if (!run) {
      return res.json({ found: false, workflow });
    }

    res.json({
      found: true,
      workflow,
      run: {
        id:          run.id,
        status:      run.status,       // queued, in_progress, completed
        conclusion:  run.conclusion,   // success, failure, cancelled, null
        html_url:    run.html_url,
        created_at:  run.created_at,
        updated_at:  run.updated_at,
        run_number:  run.run_number,
      },
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const data   = err.response?.data   || { message: err.message };
    console.error('[Tests] Erro ao buscar status:', status, data);
    res.status(status).json({ error: data.message || err.message });
  }
}));

// GET /api/tests/browserstack — Busca public_url do build mais recente
router.get('/browserstack', asyncHandler(async (req, res) => {
  const bsUser = process.env.BS_USER;
  const bsKey  = process.env.BS_KEY;

  if (!bsUser || !bsKey) {
    return res.status(500).json({ error: 'BS_USER ou BS_KEY não configurados no .env', public_url: 'indisponível' });
  }

  try {
    const response = await axios.get(
      'https://api-cloud.browserstack.com/app-automate/builds.json?limit=1',
      { auth: { username: bsUser, password: bsKey } }
    );

    const builds = response.data || [];
    const publicUrl = builds[0]?.automation_build?.public_url || 'indisponível';

    res.json({ public_url: publicUrl });
  } catch (err) {
    console.error('[Tests] BrowserStack error:', err.message);
    res.json({ public_url: 'indisponível', error: err.message });
  }
}));

module.exports = router;
