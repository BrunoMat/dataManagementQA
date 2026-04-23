// ============================================================
//  transfer-order.js — Transfer Order (frontend)
//
//  Responsabilidade: selecionar CD origem e HUB destino,
//  carregar produtos em comum (interseção de inventário),
//  selecionar produtos/quantidades, criar TO no Salesforce.
//  Dependências: state.js, helpers.js, db.js
// ============================================================

const TEMP_OPTIONS = ['Room Temperature', 'Chilled', 'Refrigerated', 'Frozen'];

/** Estado interno da Transfer Order */
const TO_STATE = {
  cd:        null,
  hub:       null,
  products:  [],
  selection: {},
};

// ── Step 1: Selecionar CD origem ─────────────────────────────

async function toRenderCDList() {
  const hubs = await DB.getHubs();
  const grid = document.getElementById('to-cd-grid');
  if (!grid) return;

  const q = (document.getElementById('to-cd-search')?.value || '').toLowerCase();
  const filtered = hubs.filter(h =>
    h.active && (!q || h.name.toLowerCase().includes(q) || (h.city || '').toLowerCase().includes(q))
  );

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏢</div>
        <div class="empty-title">Nenhum CD/HUB encontrado</div>
        <div>Cadastre na aba Config</div>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(h => `
    <div class="hub-card" onclick="toSelectCD('${h.id}')">
      <div class="hub-card-top">
        <div class="hub-name">${h.name}</div>
      </div>
      <div class="hub-city">${h.city} — ${h.uf}</div>
      <div class="hub-stats">CD / Hub origem</div>
    </div>`).join('');
}

async function toSelectCD(hubId) {
  const hubs = await DB.getHubs();
  TO_STATE.cd = hubs.find(h => h.id === hubId);
  if (!TO_STATE.cd) return;

  document.getElementById('to-bc-cd').textContent = TO_STATE.cd.name;
  toast(`Origem selecionada: ${TO_STATE.cd.name}`, 'ok');
  await toRenderHubList();
  toShowStep(2);
}

// ── Step 2: Selecionar HUB destino ───────────────────────────

async function toRenderHubList() {
  const hubs = await DB.getHubs();
  const grid = document.getElementById('to-hub-grid');
  if (!grid) return;

  const available = hubs.filter(h => h.active && h.id !== TO_STATE.cd.id);

  if (!available.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">Nenhum HUB de destino disponível</div>
        <div>Cadastre mais HUBs na aba Config</div>
      </div>`;
    return;
  }

  grid.innerHTML = available.map(h => `
    <div class="hub-card" onclick="toSelectHub('${h.id}')">
      <div class="hub-card-top">
        <div class="hub-name">${h.name}</div>
      </div>
      <div class="hub-city">${h.city} — ${h.uf}</div>
      <div class="hub-stats">Hub destino</div>
    </div>`).join('');
}

async function toSelectHub(hubId) {
  const hubs = await DB.getHubs();
  TO_STATE.hub = hubs.find(h => h.id === hubId);
  if (!TO_STATE.hub) return;

  document.getElementById('to-ctx-cd').textContent  = TO_STATE.cd.name;
  document.getElementById('to-ctx-hub').textContent = TO_STATE.hub.name;
  document.getElementById('to-bc-hub').textContent  = TO_STATE.hub.name;

  toast(`Destino selecionado: ${TO_STATE.hub.name}`, 'ok');
  toShowStep(3);
  await toFetchProducts();
}

// ── Step 3: Carregar produtos (interseção CD ∩ HUB) ─────────

async function toFetchProducts() {
  TO_STATE.products  = [];
  TO_STATE.selection = {};

  const tbody = document.getElementById('to-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr><td colspan="7" class="po-loading">
        <span class="spinner"></span> Buscando produtos em comum…
      </td></tr>`;
  }

  renderApiStatus('loading', `Inventário cruzado: ${TO_STATE.cd.name} ∩ ${TO_STATE.hub.name}…`);
  toast(`Carregando produtos: ${TO_STATE.cd.name} → ${TO_STATE.hub.name}…`, 'info');

  try {
    const params = new URLSearchParams({
      cd:  TO_STATE.cd.name,
      hub: TO_STATE.hub.name,
    });

    const res = await fetch(`/api/to/cross-inventory?${params}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Erro ao buscar inventário');

    TO_STATE.products = data.products || [];
    TO_STATE.products.forEach(p => {
      TO_STATE.selection[p.productId] = { qty: 1, selected: false };
    });

    document.getElementById('to-prod-count').textContent = TO_STATE.products.length;
    renderApiStatus('ok', `${TO_STATE.products.length} produtos em comum (${data.cdTotal} CD · ${data.hubTotal} HUB)`);
    toast(`${TO_STATE.products.length} produtos carregados`, 'ok');

    if (!TO_STATE.products.length) {
      toast('Nenhum produto em comum entre CD e HUB.', 'err');
    }
  } catch (e) {
    console.error('[toFetchProducts]', e);
    renderApiStatus('error', 'Erro: ' + e.message);
    toast('Erro ao buscar inventário: ' + e.message, 'err');
  }

  toRenderTable();
}

// ── Filtros ──────────────────────────────────────────────────

function _toGetSelectedTemps() {
  const cbs = document.querySelectorAll('#to-temp-group input[type=checkbox]');
  const sel = [...cbs].filter(c => c.checked).map(c => c.value);
  return sel;
}

function toOnTempChange() {
  document.querySelectorAll('#to-temp-group .uom-chip').forEach(chip => {
    chip.classList.toggle('active', chip.querySelector('input')?.checked);
  });
  toRenderTable();
}

function _toFilteredList() {
  const q = (document.getElementById('to-prod-search')?.value || '').toLowerCase().trim();
  const temps = _toGetSelectedTemps();

  return TO_STATE.products.filter(p => {
    // Filtro de texto
    const matchText = !q ||
      p.productName?.toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q);

    // Filtro de temperatura
    const matchTemp = temps.length === 0 || temps.includes(p.temperature);

    return matchText && matchTemp;
  });
}

// ── Tabela de produtos ───────────────────────────────────────

const TEMP_COLORS = {
  'Room Temperature': { bg: 'var(--amber-dim)', color: 'var(--amber)' },
  'Chilled':          { bg: 'rgba(59,130,246,.12)', color: 'var(--accent)' },
  'Refrigerated':     { bg: 'rgba(34,197,94,.12)', color: 'var(--green)' },
  'Frozen':           { bg: 'rgba(139,92,246,.12)', color: 'var(--purple)' },
};

function _tempBadge(temp) {
  if (!temp) return '<span style="color:var(--text3);font-size:10px">—</span>';
  const c = TEMP_COLORS[temp] || { bg: 'var(--bg4)', color: 'var(--text2)' };
  return `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${c.bg};color:${c.color};white-space:nowrap">${temp}</span>`;
}

function toRenderTable() {
  const filtered = _toFilteredList();
  const tbody    = document.getElementById('to-body');
  if (!tbody) return;

  document.getElementById('to-count-lbl').textContent =
    filtered.length + ' produto' + (filtered.length !== 1 ? 's' : '');

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="7" class="po-empty">
        <div class="po-empty-icon">🔍</div>
        <div class="po-empty-title">Nenhum produto encontrado</div>
        <div>Verifique os filtros ou se CD e HUB possuem inventário em comum</div>
      </td></tr>`;
    _toUpdateFooter();
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const st = TO_STATE.selection[p.productId] || { qty: 1, selected: false };

    return `
    <tr class="${st.selected ? 'po-selected' : ''}" id="to-row-${p.productId}">
      <td class="td-chk">
        <label class="chk-wrap">
          <input type="checkbox" ${st.selected ? 'checked' : ''}
            onchange="toToggleRow('${p.productId}',this.checked)"/>
          <span class="chk-box"></span>
        </label>
      </td>
      <td title="${esc(p.productName)}">${p.productName}</td>
      <td class="td-code">${p.sku || ''}</td>
      <td class="td-code">${p.barcode || ''}</td>
      <td>${_tempBadge(p.temperature)}</td>
      <td>
        <div class="qty-cell">
          <button class="qty-btn" onclick="toChangeQty('${p.productId}',-1)">−</button>
          <input class="qty-input" type="text" inputmode="decimal"
            id="to-qty-${p.productId}" value="${st.qty}"
            onchange="toSetQty('${p.productId}',this.value)"
            oninput="toSetQty('${p.productId}',this.value)"/>
          <button class="qty-btn" onclick="toChangeQty('${p.productId}',+1)">+</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  _toUpdateFooter();
  _toUpdateChkAll(filtered);
}

// ── Seleção e quantidades ────────────────────────────────────

function toToggleRow(key, checked) {
  if (!TO_STATE.selection[key]) TO_STATE.selection[key] = { qty: 1, selected: false };
  TO_STATE.selection[key].selected = checked;
  document.getElementById('to-row-' + key)?.classList.toggle('po-selected', checked);
  _toUpdateFooter();
  _toUpdateChkAll(_toFilteredList());
}

function toSetQty(key, val) {
  if (!TO_STATE.selection[key]) TO_STATE.selection[key] = { qty: 1, selected: false };
  const n = parseNum(val);
  TO_STATE.selection[key].qty = n > 0 ? n : 1;
  _toUpdateFooter();
}

function toChangeQty(key, delta) {
  if (!TO_STATE.selection[key]) TO_STATE.selection[key] = { qty: 1, selected: false };
  const next = Math.max(1, (TO_STATE.selection[key].qty || 1) + delta);
  TO_STATE.selection[key].qty = next;
  const inp = document.getElementById('to-qty-' + key);
  if (inp) inp.value = next;
  _toUpdateFooter();
}

function toToggleAll(checked) {
  _toFilteredList().forEach(p => {
    if (!TO_STATE.selection[p.productId]) TO_STATE.selection[p.productId] = { qty: 1, selected: false };
    TO_STATE.selection[p.productId].selected = checked;
  });
  toRenderTable();
}

function toFilter() { toRenderTable(); }

function _toUpdateFooter() {
  const sel   = TO_STATE.products.filter(p => TO_STATE.selection[p.productId]?.selected);
  const count = sel.length;
  const totalQty = sel.reduce((s, p) => s + (TO_STATE.selection[p.productId]?.qty || 1), 0);

  const sl = document.getElementById('to-sel-lbl');
  const te = document.getElementById('to-total-qty');
  if (sl) sl.textContent = count > 0 ? count + ' selecionado' + (count > 1 ? 's' : '') : 'Nenhum selecionado';
  if (te) te.textContent = totalQty + ' un';

  const btn = document.getElementById('btn-create-to');
  if (btn) btn.disabled = count === 0;
}

function _toUpdateChkAll(list) {
  const el = document.getElementById('to-chk-all');
  if (!el || !list.length) return;
  const n = list.filter(p => TO_STATE.selection[p.productId]?.selected).length;
  el.indeterminate = n > 0 && n < list.length;
  el.checked       = n === list.length && list.length > 0;
}

// ── Criar Transfer Order ─────────────────────────────────────

async function toCreate() {
  const sel = TO_STATE.products.filter(p => TO_STATE.selection[p.productId]?.selected);
  if (!sel.length) { toast('Selecione ao menos um produto.', 'err'); return; }
  if (!TO_STATE.cd || !TO_STATE.hub) { toast('Selecione CD e HUB.', 'err'); return; }

  renderApiStatus('loading', 'Verificando autenticação…');
  toast('Verificando autenticação SF…', 'info');
  const authed = await authCheck(false);
  if (!authed) {
    toast('Falha na autenticação com o Salesforce.', 'err');
    return;
  }

  renderApiStatus('loading', `Criando TO: ${TO_STATE.cd.name} → ${TO_STATE.hub.name}…`);
  toast(`Criando Transfer Order: ${sel.length} produto(s)…`, 'info');
  const btn = document.getElementById('btn-create-to');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Criando TO…'; }

  try {
    const products = sel.map(p => ({
      productId:       p.productId,
      qty:             TO_STATE.selection[p.productId]?.qty || 1,
      fromHubProduct:  p.fromHubProduct,
      toHubProduct:    p.toHubProduct,
      fromInventoryId: p.fromInventoryId,
      toInventoryId:   p.toInventoryId,
      fromLocation:    p.fromLocation,
    }));

    const res = await fetch('/api/to/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cdName:  TO_STATE.cd.name,
        hubName: TO_STATE.hub.name,
        products,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data.error || data));

    renderApiStatus('ok', `TO: ${data.toId} | ${data.toliCount} itens`);

    const lastEl = document.getElementById('to-last-result');
    if (lastEl) {
      const base = await ensureSfBase();
      if (base) {
        const url = base.replace(/\/$/, '') + `/lightning/r/Transfer_Order__c/${data.toId}/view`;
        lastEl.innerHTML = `<a href="${url}" target="_blank" rel="noopener">TO: ${data.toId}</a> · ${data.toliCount} TOLI(s)`;
      } else {
        lastEl.textContent = `TO: ${data.toId} · ${data.toliCount} TOLI(s)`;
      }
    }

    toast(`✅ Transfer Order criada: ${data.toId} | ${data.toliCount} itens`, 'ok');

  } catch (e) {
    renderApiStatus('error', 'Erro ao criar TO: ' + e.message);
    toast('Erro: ' + e.message, 'err');
    console.error('[toCreate]', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬆ Criar Transfer Order'; }
  }
}

// ── Navegação (steps) ────────────────────────────────────────

function toShowStep(n) {
  [1, 2, 3].forEach(i => {
    const el = document.getElementById('to-step' + i);
    if (el) el.style.display = i === n ? '' : 'none';
  });
}

function toBack1() {
  TO_STATE.cd = null;
  TO_STATE.hub = null;
  TO_STATE.products = [];
  TO_STATE.selection = {};
  toShowStep(1);
  toRenderCDList();
}

function toBack2() {
  TO_STATE.hub = null;
  TO_STATE.products = [];
  TO_STATE.selection = {};
  toShowStep(2);
}
