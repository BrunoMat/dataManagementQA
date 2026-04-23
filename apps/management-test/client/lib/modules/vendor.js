// ============================================================
//  vendor.js — Gerenciamento de Vendors
//
//  Responsabilidade: renderizar lista de vendors, selecionar
//  vendor, CRUD de vendors (modal), clear vendor.
//  Dependências: state.js, helpers.js, db.js
// ============================================================

// ── Listagem de vendors (Step 2 do wizard) ───────────────────

async function renderVendorList() {
  const grid = document.getElementById('vendor-grid');
  if (!grid) return;

  document.getElementById('bc-hub').textContent     = STATE.hub.name;
  document.getElementById('bc-hub-btn').textContent  = STATE.hub.name;

  const vendors = await DB.getVendorsByHub(STATE.hub.id);
  const active  = vendors.filter(v => v.active);

  if (!active.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏭</div>
        <div class="empty-title">Nenhum vendor ativo neste HUB</div>
        <div>Gerencie vínculos na aba Hubs</div>
      </div>`;
    return;
  }

  grid.innerHTML = active.map(v => {
    const hasSfId = !!v.sf_account_id;
    return `
      <div class="vendor-card" id="vcard-${v.id}" onclick="selectVendor('${v.id}')">
        <div class="vendor-card-top">
          <div class="vendor-avatar">${v.name.charAt(0)}</div>
          <div>
            <div class="vendor-name">${v.name}</div>
            <div class="vendor-cnpj">${fmtCNPJ(v.cnpj)}</div>
            ${hasSfId
              ? '<div style="font-size:10px;color:var(--green);margin-top:2px">✓ SF ID vinculado</div>'
              : '<div style="font-size:10px;color:var(--amber);margin-top:2px">⚠ Sem SF Account ID</div>'}
          </div>
        </div>
      </div>`;
  }).join('');
}

async function selectVendor(vendor_id) {
  const vendors = await DB.getVendors();
  const found   = vendors.find(v => v.id === vendor_id);
  if (!found) return;

  STATE.vendor = {
    ...found,
    sf_account_id: found.sf_account_id || null // garante que o campo existe
  };

  document.getElementById('ctx-hub').textContent       = STATE.hub.name;
  document.getElementById('ctx-vendor').textContent    = STATE.vendor.name;
  document.getElementById('ctx-cnpj').textContent      = fmtCNPJ(STATE.vendor.cnpj);
  document.getElementById('bc-vendor').textContent     = STATE.vendor.name;
  document.getElementById('ctx-prod-count').textContent = '…';

  const sfIdWarn = document.getElementById('sf-id-warn');
  if (sfIdWarn) {
    sfIdWarn.style.display = STATE.vendor.sf_account_id ? 'none' : '';
  }

  document.getElementById('emRazao').value = STATE.vendor.name;
  document.getElementById('emCnpj').value  = fmtCNPJ(STATE.vendor.cnpj);
  document.getElementById('destNome').value = 'DAKI';

  autoFillNFKey();
  showStep(3);
  await fetchVendorProducts();
}

// ── Clear vendor selecionado ─────────────────────────────────

async function clearSelectedVendor() {
  STATE.vendor   = null;
  STATE.products = [];
  STATE.poState  = {};

  const ctxHub    = document.getElementById('ctx-hub');
  const ctxVendor = document.getElementById('ctx-vendor');
  const ctxCnpj   = document.getElementById('ctx-cnpj');
  const prodCount = document.getElementById('ctx-prod-count');

  if (ctxHub)    ctxHub.textContent    = STATE.hub ? STATE.hub.name : '—';
  if (ctxVendor) ctxVendor.textContent = '—';
  if (ctxCnpj)   ctxCnpj.textContent   = '—';
  if (prodCount) prodCount.textContent = '0';

  await poRender();
}

// ── Aba de gerenciamento de vendors ──────────────────────────

async function renderVendorsMgmt() {
  const vendors = await DB.getVendors();
  const el      = document.getElementById('vendors-list');
  if (!el) return;

  if (!vendors.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏭</div>
        <div class="empty-title">Nenhum vendor cadastrado</div>
      </div>`;
    return;
  }

  const rows = await Promise.all(vendors.map(async v => {
    try {
      const prods  = await DB.getProductsByVendor(v.id);
      const active = prods.filter(p => p.active !== false).length;
      return { v, total: prods.length, active };
    } catch (err) {
      console.warn(`[renderVendorsMgmt] Erro ao carregar produtos para ${v.name}:`, err);
      return { v, total: 0, active: 0, error: true };
    }
  }));

  el.innerHTML = rows.map(({ v, total, active }) => `
    <div class="mgmt-card">
      <div class="mgmt-card-top">
        <div class="vendor-avatar sm">${v.name.charAt(0)}</div>
        <div style="flex:1">
          <div class="mgmt-name">
            ${v.name}
            ${!v.active ? '<span class="badge-inactive">Inativo</span>' : ''}
            ${v.sf_account_id
              ? '<span style="font-size:10px;background:var(--green-dim);color:var(--green);padding:1px 6px;border-radius:4px;margin-left:4px">✓ SF</span>'
              : '<span style="font-size:10px;background:var(--amber-dim);color:var(--amber);padding:1px 6px;border-radius:4px;margin-left:4px">⚠ Sem SF ID</span>'}
          </div>
          <div class="mgmt-sub">
            ${fmtCNPJ(v.cnpj)}
            ${v.sf_account_id ? ` · SF: <code style="font-size:10px">${v.sf_account_id}</code>` : ''}
            · ${active}/${total} produtos (cache)
          </div>
        </div>
        <div class="mgmt-actions">
          <button class="btn-ghost" style="padding:5px 10px" onclick="openVendorModal('${v.id}')">Editar</button>
          <button class="btn-danger" onclick="confirmDeleteVendor('${v.id}')">Excluir</button>
        </div>
      </div>
    </div>`).join('');
}

// ── Modal de Vendor ──────────────────────────────────────────

function openVendorModal(id) {
  STATE.vendorModal.editing = id || null;
  document.getElementById('vendor-modal-title').textContent = id ? 'Editar Vendor' : 'Novo Vendor Product';

  ['ven-f-name', 'ven-f-cnpj', 'ven-f-sfid'].forEach(i => {
    const el = document.getElementById(i);
    if (el) el.value = '';
  });
  document.getElementById('ven-f-active').checked = true;

  if (id) {
    DB.getVendors().then(vs => {
      const v = vs.find(x => x.id === id);
      if (!v) return;
      document.getElementById('ven-f-name').value    = v.name;
      document.getElementById('ven-f-cnpj').value    = v.cnpj;
      document.getElementById('ven-f-sfid').value    = v.sf_account_id || '';
      document.getElementById('ven-f-active').checked = v.active;
    });
  }

  document.getElementById('modal-vendor').style.display = 'flex';
}

function closeVendorModal() {
  document.getElementById('modal-vendor').style.display = 'none';
}

async function saveVendorModal() {
  const name          = document.getElementById('ven-f-name').value.trim();
  const cnpj          = document.getElementById('ven-f-cnpj').value.replace(/\D/g, '');
  const sf_account_id = document.getElementById('ven-f-sfid').value.trim();
  const active        = document.getElementById('ven-f-active').checked;

  if (!name)            { toast('Nome obrigatório.', 'err'); return; }
  if (cnpj.length !== 14) { toast('CNPJ deve ter 14 dígitos.', 'err'); return; }

  const vendorId = STATE.vendorModal.editing || ('ven-' + Date.now());
  await DB.saveVendor({ id: vendorId, name, cnpj, sf_account_id, active });

  // Atualiza banner se o vendor editado está selecionado
  if (STATE.vendor?.id === STATE.vendorModal.editing) {
    STATE.vendor.sf_account_id = sf_account_id;
    const warn = document.getElementById('sf-id-warn');
    if (warn) warn.style.display = sf_account_id ? 'none' : '';
  }

  closeVendorModal();
  await renderVendorsMgmt();
  toast('Vendor salvo!', 'ok');
}

async function confirmDeleteVendor(id) {
  showConfirm('Excluir Vendor', 'Vínculos serão removidos.', async () => {
    await DB.deleteVendor(id);
    await renderVendorsMgmt();
    toast('Vendor excluído.', 'info');

    if (STATE.vendor?.id === id) {
      clearSelectedVendor();
    }
  });
}
