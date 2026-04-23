// ============================================================
//  state.js — Estado global da aplicação e UI genérica
//
//  Responsabilidade: gerenciar STATE, toast, API status,
//  confirm modal. Dependência: helpers.js
// ============================================================

/** Estado global da aplicação */
const STATE = {
  hub:         null,
  vendor:      null,
  products:    [],
  poState:     {},
  hubModal:    { editing: null },
  vendorModal: { editing: null },
  sfReady:     false,
};

/** Itens da Nota Fiscal */
let items = [];

/** Base URL do Salesforce (cacheada após primeiro ping) */
let SF_BASE_CLIENT = null;

// ── Salesforce Base URL ──────────────────────────────────────

async function ensureSfBase() {
  if (SF_BASE_CLIENT) return SF_BASE_CLIENT;
  try {
    const res = await fetch('/api/sf/ping');
    if (!res.ok) return null;
    const d = await res.json();
    SF_BASE_CLIENT = d.base || null;
    return SF_BASE_CLIENT;
  } catch {
    return null;
  }
}

// ── Toast ────────────────────────────────────────────────────

function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = 'toast', 3200);
}

// ── API Status ───────────────────────────────────────────────

function renderApiStatus(state, msg) {
  const el = document.getElementById('api-status');
  if (!el) return;

  const labels = {
    idle:    'Aguardando',
    loading: msg || 'Consultando Salesforce…',
    ok:      msg || 'Conectado',
    error:   msg || 'Erro',
  };

  el.className   = 'api-status ' + state;
  el.textContent = labels[state] || msg || state;
}

// ── Autenticação SF ──────────────────────────────────────────

/**
 * Verifica conectividade com o Salesforce.
 * @param {boolean} silent - Se true, não exibe toast de erro
 * @returns {boolean} true se conectado
 */
async function authCheck(silent = true) {
  try {
    const res  = await fetch('/api/sf/ping');
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Falha no ping');

    STATE.sfReady = true;
    const expireTime = new Date(data.expires).toLocaleTimeString('pt-BR');
    renderApiStatus('ok', `SF conectado · token expira ${expireTime}`);
    return true;
  } catch (e) {
    STATE.sfReady = false;
    renderApiStatus('error', 'SF desconectado: ' + e.message);
    if (!silent) toast('Falha na autenticação SF: ' + e.message, 'err');
    return false;
  }
}

// ── Confirm Modal ────────────────────────────────────────────

function showConfirm(title, body, onOk) {
  document.getElementById('mc-title').textContent = title;

  const bodyEl = document.getElementById('mc-body');
  // Support multiline text via whitespace pre-wrap
  bodyEl.textContent  = body;
  bodyEl.style.whiteSpace = 'pre-wrap';

  const btn = document.getElementById('mc-ok');
  btn.onclick = () => { closeConfirm(); onOk(); };

  document.getElementById('modal-confirm').style.display = 'flex';
}

function closeConfirm() {
  document.getElementById('modal-confirm').style.display = 'none';
}

// Fecha modais ao clicar no backdrop
document.addEventListener('click', e => {
  ['modal-confirm', 'modal-hub', 'modal-vendor', 'modal-rops-addr', 'modal-rops-products', 'modal-rops-scenario'].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.target === el) el.style.display = 'none';
  });
});
