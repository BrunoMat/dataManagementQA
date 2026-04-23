// ============================================================
//  hub.js — Gerenciamento de HUBs
//
//  Responsabilidade: renderizar lista de hubs, selecionar hub,
//  CRUD de hubs (modal), link/unlink com vendors.
//  Dependências: state.js, helpers.js, db.js
// ============================================================

// ── Listagem de hubs (Step 1 do wizard) ──────────────────────

async function renderHubList() {
  const hubs = await DB.getHubs();
  const q    = (document.getElementById('hub-search')?.value || '').toLowerCase();
  const grid = document.getElementById('hub-grid');
  if (!grid) return;

  const filtered = hubs.filter(h =>
    !q || h.name.toLowerCase().includes(q) || (h.city || '').toLowerCase().includes(q)
  );

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏢</div>
        <div class="empty-title">Nenhum HUB encontrado</div>
        <div>Cadastre HUBs na aba Hubs</div>
      </div>`;
    return;
  }

  const cards = await Promise.all(filtered.map(async h => {
    const vendors = await DB.getVendorsByHub(h.id);
    const active  = vendors.filter(v => v.active);
    return { h, vendors, active };
  }));

  grid.innerHTML = cards.map(({ h, vendors, active }) => `
    <div class="hub-card ${!h.active ? 'inactive' : ''}" onclick="selectHub('${h.id}')">
      <div class="hub-card-top">
        <div class="hub-name">${h.name}</div>
        ${!h.active ? '<span class="badge-inactive">Inativo</span>' : ''}
      </div>
      <div class="hub-city">${h.city} — ${h.uf}</div>
      <div class="hub-stats">
        <b>${active.length}</b> vendors ativos
        <span style="color:var(--border2)">·</span> ${vendors.length} total
      </div>
    </div>`).join('');
}

async function selectHub(hub_id) {
  const hubs = await DB.getHubs();
  STATE.hub  = hubs.find(h => h.id === hub_id);
  if (!STATE.hub) return;

  await renderVendorList();
  showStep(2);
}

// ── Aba de gerenciamento de hubs ─────────────────────────────

async function renderHubsMgmt() {
  const hubs = await DB.getHubs();
  const el   = document.getElementById('hubs-list');
  if (!el) return;

  if (!hubs.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏢</div>
        <div class="empty-title">Nenhum hub cadastrado</div>
      </div>`;
    return;
  }

  const rows = await Promise.all(hubs.map(async h => {
    const vendors = await DB.getVendorsByHub(h.id);
    const allV    = await DB.getVendors();
    return { h, vendors, allV };
  }));

  el.innerHTML = rows.map(({ h, vendors, allV }) => `
    <div class="mgmt-card">
      <div class="mgmt-card-top">
        <div>
          <div class="mgmt-name">${h.name} <span class="mgmt-uf">${h.uf}</span></div>
          <div class="mgmt-sub">${h.city} · ${vendors.length} vendor(s)</div>
        </div>
        <div class="mgmt-actions">
          <button class="btn-ghost" style="padding:5px 10px" onclick="openHubModal('${h.id}')">Editar</button>
          <button class="btn-danger" onclick="confirmDeleteHub('${h.id}')">Excluir</button>
        </div>
      </div>
      <div class="mgmt-links">
        ${allV.map(v => {
          const linked = vendors.some(lv => lv.id === v.id);
          return `
            <label class="link-toggle ${linked ? 'linked' : ''}">
              <input type="checkbox" ${linked ? 'checked' : ''}
                onchange="toggleHubVendorLink('${h.id}','${v.id}',this.checked)"/>
              ${v.name}
            </label>`;
        }).join('')}
      </div>
    </div>`).join('');
}

// ── Hub-Vendor linking ───────────────────────────────────────

async function toggleHubVendorLink(hub_id, vendor_id, checked) {
  if (checked) {
    // Busca o vendor para pegar o sf_account_id se existir
    const vendors = await DB.getVendors();
    const vendor = vendors.find(v => v.id === vendor_id);
    await DB.linkHubVendor(hub_id, vendor_id, vendor?.sf_account_id);
  } else {
    await DB.unlinkHubVendor(hub_id, vendor_id);
  }

  await renderHubsMgmt();
  toast(checked ? 'Vínculo criado.' : 'Vínculo removido.', 'info');

  if (!checked && STATE.vendor?.id === vendor_id && STATE.hub?.id === hub_id) {
    clearSelectedVendor();
  }
}

// ── Modal de Hub ─────────────────────────────────────────────

function openHubModal(id) {
  STATE.hubModal.editing = id || null;
  document.getElementById('hub-modal-title').textContent = id ? 'Editar Hub' : 'Novo Hub';

  ['hub-f-name', 'hub-f-city', 'hub-f-uf'].forEach(i =>
    document.getElementById(i).value = ''
  );
  document.getElementById('hub-f-active').checked = true;

  if (id) {
    DB.getHubs().then(hs => {
      const h = hs.find(x => x.id === id);
      if (!h) return;
      document.getElementById('hub-f-name').value   = h.name;
      document.getElementById('hub-f-city').value   = h.city;
      document.getElementById('hub-f-uf').value     = h.uf;
      document.getElementById('hub-f-active').checked = h.active;
    });
  }

  document.getElementById('modal-hub').style.display = 'flex';
}

function closeHubModal() {
  document.getElementById('modal-hub').style.display = 'none';
}

async function saveHubModal() {
  const name   = document.getElementById('hub-f-name').value.trim();
  const city   = document.getElementById('hub-f-city').value.trim();
  const uf     = document.getElementById('hub-f-uf').value.trim().toUpperCase();
  const active = document.getElementById('hub-f-active').checked;

  if (!name) { toast('Nome obrigatório.', 'err'); return; }

  const hubId = STATE.hubModal.editing || ('hub-' + Date.now());
  await DB.saveHub({ id: hubId, name, city, uf, active });

  closeHubModal();
  await renderHubsMgmt();
  await renderHubList();
  toast('Hub salvo!', 'ok');

  try {
    if (STATE.vendor) {
      if (STATE.hub?.id === hubId) await renderVendorList();
      await fetchVendorProducts();
    }
  } catch (e) {
    console.warn('Erro ao atualizar produtos após salvar hub', e);
  }
}

async function confirmDeleteHub(id) {
  showConfirm('Excluir Hub', 'Vínculos também serão removidos.', async () => {
    await DB.deleteHub(id);
    await renderHubsMgmt();
    await renderHubList();
    toast('Hub excluído.', 'info');

    if (STATE.hub?.id === id) {
      STATE.hub = null;
      clearSelectedVendor();
    }
  });
}
