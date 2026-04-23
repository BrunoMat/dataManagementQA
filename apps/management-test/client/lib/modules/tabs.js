// ============================================================
//  tabs.js — Navegação entre abas e steps do wizard
//
//  Responsabilidade: top-tabs (asn/config/invoice/po/to),
//  invoice-tabs (li/emit/dest/trib), config-tabs (hubs/vendors),
//  steps do wizard PO e TO.
//  Dependências: state.js, hub.js, vendor.js, po-table.js, nf-items.js
// ============================================================

// ── Top-level tabs (ASN / Config / Invoice / PO / TO) ────────

function setTopTab(t) {
  const views = ['config', 'invoice', 'po', 'to'];

  views.forEach(id => {
    const el = document.getElementById('view-' + id);
    if (el) el.style.display = id === t ? '' : 'none';
  });

  const buttons = document.querySelectorAll('.top-tab');
  buttons.forEach((btn, i) => {
    btn.classList.toggle('active', views[i] === t);
  });

  if (t === 'to') {
    toRenderCDList();
  } else if (t === 'config') {
    renderHubsMgmt();
    renderVendorsMgmt();
  } else if (t === 'invoice') {
    renderItems();
    updateNFBadge();
  } else if (t === 'po') {
    renderHubList();
  }
}

// ── Invoice sub-tabs (Invoice LI / Emitente / Destinatário / Tributos) ──

function setInvoiceTab(t) {
  const tabIds = ['inv-li', 'inv-dest', 'inv-emit', 'inv-trib'];

  tabIds.forEach(id => {
    const el = document.getElementById('subtab-' + id);
    if (el) el.style.display = id === t ? '' : 'none';
  });

  document.querySelectorAll('#invoice-tabs-bar .sub-tab').forEach((el, i) => {
    el.classList.toggle('active', tabIds[i] === t);
  });

  if (t === 'inv-li') {
    renderItems();
    updateNFBadge();
  }
}

// ── Config sub-tabs (Hubs / Vendors) ─────────────────────────

function setConfigTab(t) {
  const tabIds = ['cfg-hubs', 'cfg-vendors'];

  tabIds.forEach(id => {
    const el = document.getElementById('subtab-' + id);
    if (el) el.style.display = id === t ? '' : 'none';
  });

  document.querySelectorAll('#view-config .sub-tab').forEach((el, i) => {
    el.classList.toggle('active', tabIds[i] === t);
  });

  try {
    if (t === 'cfg-hubs')    renderHubsMgmt();
    if (t === 'cfg-vendors') renderVendorsMgmt();
  } catch (e) {
    console.warn('[setConfigTab]', e);
  }
}

// ── Steps do wizard PO ───────────────────────────────────────

function showStep(n) {
  [1, 2, 3].forEach(i => {
    const el = document.getElementById('po-step' + i);
    if (el) el.style.display = i === n ? '' : 'none';
  });
}

function poBack1() {
  STATE.hub = null;
  STATE.vendor = null;
  STATE.products = [];
  showStep(1);
  renderHubList();
}

function poBack2() {
  STATE.vendor = null;
  STATE.products = [];
  showStep(2);
}
