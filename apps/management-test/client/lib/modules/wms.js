// ============================================================
//  wms.js — WMS / Midgard (INVR) Operations
// ============================================================

function wmsInit() {}
function setWmsTab(tab) { /* only midgard for now */ }

function _wmsHub() { return document.getElementById('wms-hub')?.value?.trim() || 'SAO022'; }
function _wmsHost() { return document.getElementById('wms-host')?.value?.trim() || ''; }

function _wmsResultHtml(data, type) {
  const json = JSON.stringify(data, null, 2);
  const color = type === 'ok' ? 'var(--green)' : type === 'err' ? 'var(--red)' : 'var(--text2)';
  return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px;max-height:300px;overflow:auto">
    <pre style="font-size:10px;color:${color};margin:0;white-space:pre-wrap;word-break:break-all">${esc(json)}</pre>
  </div>`;
}

// ── Buscar Inventário ────────────────────────────────────────
async function wmsSearchInventory() {
  const skusRaw = document.getElementById('wms-search-skus')?.value?.trim();
  const el = document.getElementById('wms-search-result');
  if (!skusRaw) { toast('Informe pelo menos um SKU.', 'err'); return; }

  const skus = skusRaw.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const res = await fetch('/api/wms/inventories/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hub: _wmsHub(), skus, host: _wmsHost() }),
    });
    const data = await res.json();
    if (el) el.innerHTML = _wmsResultHtml(data, res.ok ? 'ok' : 'err');
    toast(res.ok ? `✅ ${skus.length} SKU(s) buscados` : 'Erro na busca', res.ok ? 'ok' : 'err');
  } catch (e) {
    if (el) el.innerHTML = _wmsResultHtml({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

// ── Criar Location ───────────────────────────────────────────
async function wmsCreateLocation() {
  const name = document.getElementById('wms-loc-name')?.value?.trim();
  const area = document.getElementById('wms-loc-area')?.value?.trim() || 'picking';
  const el = document.getElementById('wms-loc-result');
  if (!name) { toast('Informe o nome da location.', 'err'); return; }

  try {
    const res = await fetch('/api/wms/locations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hub: _wmsHub(), name, area, host: _wmsHost() }),
    });
    const data = await res.json();
    if (el) el.innerHTML = _wmsResultHtml(data, res.ok ? 'ok' : 'err');
    toast(res.ok ? `✅ Location "${name}" criada` : 'Erro ao criar location', res.ok ? 'ok' : 'err');
  } catch (e) {
    if (el) el.innerHTML = _wmsResultHtml({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

// ── Criar Warehouse Product ──────────────────────────────────
async function wmsCreateProduct() {
  const sku = document.getElementById('wms-wp-sku')?.value?.trim();
  const el = document.getElementById('wms-wp-result');
  if (!sku) { toast('Informe o SKU.', 'err'); return; }

  try {
    const res = await fetch('/api/wms/warehouse-products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hub: _wmsHub(), sku, host: _wmsHost() }),
    });
    const data = await res.json();
    if (el) el.innerHTML = _wmsResultHtml(data, res.ok ? 'ok' : 'err');
    toast(res.ok ? `✅ Produto ${sku} criado no warehouse` : 'Erro', res.ok ? 'ok' : 'err');
  } catch (e) {
    if (el) el.innerHTML = _wmsResultHtml({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

// ── Criar Movement ───────────────────────────────────────────
async function wmsCreateMovement() {
  const type = document.getElementById('wms-mov-type')?.value || 'open';
  const kind = document.getElementById('wms-mov-kind')?.value || 'outbound';
  const refKind = document.getElementById('wms-mov-ref')?.value || 'delivery';
  const sku = document.getElementById('wms-mov-sku')?.value?.trim();
  const qty = parseInt(document.getElementById('wms-mov-qty')?.value) || 5;
  const location = document.getElementById('wms-mov-loc')?.value?.trim() || 'A-1-1-1';
  const el = document.getElementById('wms-mov-result');

  if (!sku) { toast('Informe o SKU.', 'err'); return; }

  try {
    const res = await fetch('/api/wms/movements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, hub: _wmsHub(), kind, source: 'system', referenceKind: refKind, sku, qty, location, host: _wmsHost() }),
    });
    const data = await res.json();
    if (el) el.innerHTML = _wmsResultHtml(data, res.ok ? 'ok' : 'err');

    // Se sucesso, preenche os campos de fulfill com o ID
    if (res.ok && data.id) {
      const fulId = document.getElementById('wms-ful-id');
      if (fulId) fulId.value = data.id;
      if (data.line_items?.[0]?.id) {
        const fulLiId = document.getElementById('wms-ful-liid');
        if (fulLiId) fulLiId.value = data.line_items[0].id;
      }
    }

    toast(res.ok ? `✅ Movement ${type} criado!` : 'Erro', res.ok ? 'ok' : 'err');
  } catch (e) {
    if (el) el.innerHTML = _wmsResultHtml({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

// ── Fulfill Movement ─────────────────────────────────────────
async function wmsFulfillMovement() {
  const movementId = document.getElementById('wms-ful-id')?.value?.trim();
  const lineItemId = document.getElementById('wms-ful-liid')?.value?.trim();
  const qty = parseInt(document.getElementById('wms-ful-qty')?.value) || 5;
  const location = document.getElementById('wms-ful-loc')?.value?.trim() || 'A-1-1-1';
  const state = document.getElementById('wms-ful-state')?.value || 'available';
  const el = document.getElementById('wms-ful-result');

  if (!movementId || !lineItemId) { toast('Informe Movement ID e Line Item ID.', 'err'); return; }

  try {
    const res = await fetch('/api/wms/movements/fulfill', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movementId, lineItemId, qty, location, state, host: _wmsHost() }),
    });
    const data = await res.json();
    if (el) el.innerHTML = _wmsResultHtml(data, res.ok ? 'ok' : 'err');
    toast(res.ok ? '✅ Movement fulfilled!' : 'Erro', res.ok ? 'ok' : 'err');
  } catch (e) {
    if (el) el.innerHTML = _wmsResultHtml({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

// ── Cancel Movement ──────────────────────────────────────────
async function wmsCancelMovement() {
  const movementId = document.getElementById('wms-ful-id')?.value?.trim();
  const el = document.getElementById('wms-ful-result');
  if (!movementId) { toast('Informe o Movement ID.', 'err'); return; }

  try {
    const res = await fetch('/api/wms/movements/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movementId, host: _wmsHost() }),
    });
    const data = await res.json();
    if (el) el.innerHTML = _wmsResultHtml(data, res.ok ? 'ok' : 'err');
    toast(res.ok ? '✅ Movement cancelado!' : 'Erro', res.ok ? 'ok' : 'err');
  } catch (e) {
    if (el) el.innerHTML = _wmsResultHtml({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}
