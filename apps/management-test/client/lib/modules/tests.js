// ============================================================
//  tests.js — Executar Testes (GitHub Actions)
//
//  Persiste em sessionStorage. Polling 30s.
//  BrowserStack link via /api/tests/browserstack.
// ============================================================

const TESTS = {
  currentTab: 'raio',
  currentSubTab: 'raio-app',
  runs: {},
  polling: {},
};

const GH_PAGES_URL = 'https://jokr-services.github.io/maestro_test/';
const TESTS_STORAGE_KEY = 'tests_runs';

// ── Persistência ─────────────────────────────────────────────
function _testsSave() {
  try {
    const data = {};
    for (const [k, v] of Object.entries(TESTS.runs)) data[k] = { ...v };
    sessionStorage.setItem(TESTS_STORAGE_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}
function _testsRestore() {
  try {
    const raw = sessionStorage.getItem(TESTS_STORAGE_KEY);
    if (raw) TESTS.runs = JSON.parse(raw) || {};
  } catch (e) { /* ignore */ }
}

// ── Init ─────────────────────────────────────────────────────
function testsInit() {
  _testsRestore();
  testsSetTab('raio');
  testsSetSubTab('raio-app');
  testsRenderCards();
  _testsResumePolling();
}

function _testsBootRestore() {
  _testsRestore();
  _testsResumePolling();
}

function _testsResumePolling() {
  for (const wf of Object.keys(TESTS.runs)) {
    const r = TESTS.runs[wf];
    if (r && r.runId && r.status && r.status !== 'completed') {
      if (!TESTS.polling[wf]) _startPolling(wf);
    }
  }
}

// ── Tabs ─────────────────────────────────────────────────────
function testsSetTab(tab) {
  TESTS.currentTab = tab;
  document.querySelectorAll('#tests-tabs-bar .top-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const v = document.getElementById('tests-view-raio');
  if (v) v.style.display = tab === 'raio' ? '' : 'none';
}
function testsSetSubTab(sub) {
  TESTS.currentSubTab = sub;
  document.querySelectorAll('#tests-subtabs-bar .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.subtab === sub));
  const v = document.getElementById('tests-subtab-raio-app');
  if (v) v.style.display = sub === 'raio-app' ? '' : 'none';
}

// ══════════════════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════════════════

function testsRenderCards() {
  _renderTestCard('raio_regressivo');
  _renderTestCard('raio_smoke');
}

function _renderTestCard(workflow) {
  const el = document.getElementById(`test-card-${workflow}`);
  if (!el) return;

  const run = TESTS.runs[workflow];
  const isPolling = !!TESTS.polling[workflow];
  const label = workflow === 'raio_regressivo' ? 'Regressivo' : 'Smoke';
  const icon  = workflow === 'raio_regressivo' ? '🔁' : '💨';
  const color = workflow === 'raio_regressivo' ? 'var(--accent)' : 'var(--amber)';

  let statusHtml = '';
  let actionsHtml = '';

  if (!run) {
    // ── IDLE ──
    statusHtml = `<div class="test-status-idle">Pronto para executar</div>`;
    actionsHtml = `<button class="test-btn test-btn--run" style="--test-color:${color}" onclick="testsRun('${workflow}')">▶ Executar ${label}</button>`;

  } else if (isPolling || run.status === 'queued' || run.status === 'in_progress') {
    // ── RUNNING ──
    const statusLabel = run.status === 'queued' ? 'Na fila…' : 'Em execução…';
    statusHtml = `<div class="test-status-running"><span class="spinner-sm"></span> ${statusLabel}</div>`;
    actionsHtml = `
      ${run.html_url ? `<a href="${run.html_url}" target="_blank" rel="noopener" class="test-btn test-btn--github">🔗 Ver no GitHub</a>` : ''}
      <button class="test-btn test-btn--refresh" onclick="testsForceRefresh('${workflow}')">↻ Atualizar status</button>
    `;

  } else {
    // ── COMPLETED ──
    const isSuccess = run.conclusion === 'success';
    const isError   = run.conclusion === 'failure' || run.error;
    const cIcon  = isSuccess ? '✅' : isError ? '❌' : '⚠️';
    const cLabel = run.error ? 'Erro' : (run.conclusion ? run.conclusion.charAt(0).toUpperCase() + run.conclusion.slice(1) : 'Finalizado');
    const cColor = isSuccess ? 'var(--green)' : isError ? 'var(--red)' : 'var(--amber)';

    const finishedAt = run.updated_at
      ? new Date(run.updated_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : '—';

    statusHtml = `
      <div class="test-status-done" style="--done-color:${cColor}"><span>${cIcon} ${cLabel}</span></div>
      <div class="test-finished-label">Finalizado: ${finishedAt}</div>
      ${run.error ? `<div style="font-size:11px;color:var(--red);margin-top:4px;word-break:break-word">${esc(run.error)}</div>` : ''}
    `;

    // Botões na ordem: GitHub Run | Executar novamente | Result Test | BrowserStack | Atualizar
    actionsHtml = `
      ${run.html_url ? `<a href="${run.html_url}" target="_blank" rel="noopener" class="test-btn test-btn--github">🔗 GitHub Run</a>` : ''}
      <button class="test-btn test-btn--run" style="--test-color:${color}" onclick="testsRun('${workflow}')">▶ Executar novamente</button>
      <a href="${GH_PAGES_URL}" target="_blank" rel="noopener" class="test-btn test-btn--result">📊 Result Test</a>
      <button class="test-btn test-btn--bs" onclick="testsOpenBrowserStack('${workflow}')">🅱️ BrowserStack</button>
      <button class="test-btn test-btn--refresh" onclick="testsForceRefresh('${workflow}')">↻ Atualizar status</button>
    `;
  }

  el.innerHTML = `
    <div class="test-card-header">
      <div class="test-card-icon" style="color:${color}">${icon}</div>
      <div class="test-card-info">
        <div class="test-card-name">${label}</div>
        <div class="test-card-workflow">${workflow}.yml</div>
      </div>
    </div>
    ${statusHtml}
    <div class="test-card-actions">${actionsHtml}</div>
  `;
}

// ══════════════════════════════════════════════════════════════
//  RUN WORKFLOW
// ══════════════════════════════════════════════════════════════

async function testsRun(workflow) {
  const label = workflow === 'raio_regressivo' ? 'Regressivo' : 'Smoke';

  // Para qualquer polling anterior deste workflow
  _stopPolling(workflow);

  TESTS.runs[workflow] = { status:'queued', conclusion:null, html_url:null, created_at:new Date().toISOString(), runId:null };
  _testsSave(); testsRenderCards();

  try {
    const res = await fetch('/api/tests/trigger', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({workflow}) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao disparar workflow');

    const newRunId = data.run?.id || null;

    TESTS.runs[workflow] = {
      ...TESTS.runs[workflow],
      runId: newRunId,
      status: data.run?.status || 'queued',
      html_url: data.run?.html_url || `https://github.com/JOKR-Services/maestro_test/actions/workflows/${workflow}.yml`,
    };
    _testsSave(); testsRenderCards();
    toast(`🚀 ${label} disparado!`, 'ok');

    if (newRunId) {
      _startPolling(workflow);
    } else {
      // Sem runId — inicia polling por workflow name para capturar quando aparecer
      _startPollingByWorkflow(workflow);
    }
  } catch (e) {
    TESTS.runs[workflow] = { status:'completed', conclusion:'failure', error:e.message, updated_at:new Date().toISOString() };
    _testsSave(); testsRenderCards();
    toast(`Erro ao disparar ${label}: ${e.message}`, 'err');
  }
}

// ══════════════════════════════════════════════════════════════
//  FORCE REFRESH STATUS
// ══════════════════════════════════════════════════════════════

async function testsForceRefresh(workflow) {
  const run = TESTS.runs[workflow];
  if (!run?.runId) {
    // Sem runId, tenta buscar o último run do workflow
    try {
      const res = await fetch(`/api/tests/status?workflow=${workflow}`);
      const data = await res.json();
      if (data.found && data.run) {
        TESTS.runs[workflow] = {
          ...TESTS.runs[workflow],
          runId:      data.run.id,
          status:     data.run.status,
          conclusion: data.run.conclusion,
          html_url:   data.run.html_url,
          updated_at: data.run.updated_at,
        };
        _testsSave(); testsRenderCards();
        toast('Status atualizado!', 'ok');
        if (data.run.status === 'completed') _stopPolling(workflow);
      } else {
        toast('Nenhum run encontrado.', 'info');
      }
    } catch (e) { toast('Erro: ' + e.message, 'err'); }
    return;
  }

  try {
    const res = await fetch(`/api/tests/status?runId=${run.runId}`);
    const data = await res.json();
    if (data.found && data.run) {
      TESTS.runs[workflow] = {
        ...TESTS.runs[workflow],
        status:     data.run.status,
        conclusion: data.run.conclusion,
        html_url:   data.run.html_url,
        updated_at: data.run.updated_at,
      };
      _testsSave(); testsRenderCards();

      if (data.run.status === 'completed') {
        _stopPolling(workflow);
        const isSuccess = data.run.conclusion === 'success';
        const label = workflow === 'raio_regressivo' ? 'Regressivo' : 'Smoke';
        toast(isSuccess ? `✅ ${label} finalizado com sucesso!` : `❌ ${label}: ${data.run.conclusion}`, isSuccess ? 'ok' : 'err');
      } else {
        toast('Status atualizado: ' + data.run.status, 'info');
      }
    }
  } catch (e) { toast('Erro ao atualizar: ' + e.message, 'err'); }
}

// ══════════════════════════════════════════════════════════════
//  BROWSERSTACK
// ══════════════════════════════════════════════════════════════

async function testsOpenBrowserStack(workflow) {
  try {
    const res = await fetch('/api/tests/browserstack');
    const data = await res.json();
    if (data.public_url && data.public_url !== 'indisponível') {
      window.open(data.public_url, '_blank');
    } else {
      toast('Link do BrowserStack indisponível. Verifique as credenciais no .env.', 'err');
    }
  } catch (e) {
    toast('Erro ao buscar link BrowserStack: ' + e.message, 'err');
  }
}

// ══════════════════════════════════════════════════════════════
//  POLLING (30s)
// ══════════════════════════════════════════════════════════════

function _startPolling(workflow) {
  _stopPolling(workflow); // Garante que não há polling duplicado

  const poll = async () => {
    try {
      const run = TESTS.runs[workflow];
      if (!run?.runId) return;

      const res = await fetch(`/api/tests/status?runId=${run.runId}`);
      const data = await res.json();

      if (data.found && data.run) {
        TESTS.runs[workflow] = {
          ...TESTS.runs[workflow],
          status:     data.run.status,
          conclusion: data.run.conclusion,
          html_url:   data.run.html_url,
          updated_at: data.run.updated_at,
        };
        _testsSave();
        testsRenderCards();

        if (data.run.status === 'completed') {
          _stopPolling(workflow);
          const isSuccess = data.run.conclusion === 'success';
          const label = workflow === 'raio_regressivo' ? 'Regressivo' : 'Smoke';
          toast(
            isSuccess ? `✅ ${label} finalizado com sucesso!` : `❌ ${label} finalizado: ${data.run.conclusion}`,
            isSuccess ? 'ok' : 'err'
          );
        }
      }
    } catch (e) {
      console.warn('[Tests] Polling error:', e.message);
    }
  };

  TESTS.polling[workflow] = setInterval(poll, 30000);
  poll();
}

// Fallback: polling por workflow name quando não temos runId
function _startPollingByWorkflow(workflow) {
  _stopPolling(workflow);

  const poll = async () => {
    try {
      const res = await fetch(`/api/tests/status?workflow=${workflow}`);
      const data = await res.json();

      if (data.found && data.run) {
        const createdAt = TESTS.runs[workflow]?.created_at;
        // Só aceita se o run é mais novo que o dispatch
        if (createdAt && new Date(data.run.created_at) < new Date(createdAt)) return;

        TESTS.runs[workflow] = {
          ...TESTS.runs[workflow],
          runId:      data.run.id,
          status:     data.run.status,
          conclusion: data.run.conclusion,
          html_url:   data.run.html_url,
          updated_at: data.run.updated_at,
        };
        _testsSave();
        testsRenderCards();

        // Agora que temos runId, troca para polling por ID
        if (data.run.status === 'completed') {
          _stopPolling(workflow);
          const isSuccess = data.run.conclusion === 'success';
          const label = workflow === 'raio_regressivo' ? 'Regressivo' : 'Smoke';
          toast(isSuccess ? `✅ ${label} finalizado!` : `❌ ${label}: ${data.run.conclusion}`, isSuccess ? 'ok' : 'err');
        } else {
          // Tem runId agora, troca para polling normal por ID
          _startPolling(workflow);
        }
      }
    } catch (e) {
      console.warn('[Tests] Workflow polling error:', e.message);
    }
  };

  TESTS.polling[workflow] = setInterval(poll, 15000); // Mais frequente até achar o run
  poll();
}

function _stopPolling(workflow) {
  if (TESTS.polling[workflow]) {
    clearInterval(TESTS.polling[workflow]);
    delete TESTS.polling[workflow];
  }
}

// ── Auto-boot ────────────────────────────────────────────────
_testsBootRestore();
