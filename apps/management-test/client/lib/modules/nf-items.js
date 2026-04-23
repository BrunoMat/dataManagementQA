// ============================================================
//  nf-items.js — Itens da Nota Fiscal
//
//  Responsabilidade: adicionar, remover, renderizar itens da NF,
//  controlar quantidades, atualizar sumário e badge.
//  Dependências: state.js, helpers.js
// ============================================================

// ── CRUD de itens ────────────────────────────────────────────

function addItem() {
  items.push({
    cod: '', desc: '', ncm: '', cfop: '5.102', un: 'UN',
    qtd: 1, unit: 0, sku: '', barcode: '', qtyPerUnit: '—',
  });

  renderItems();

  // Foca na descrição da última linha
  const rows = document.querySelectorAll('#itemsArea tr');
  const last = rows[rows.length - 1];
  if (last) {
    const d = last.querySelector('.nf-inp-desc');
    if (d) d.focus();
  }
}

function removeItem(i) {
  items.splice(i, 1);
  renderItems();
  updateNFBadge();
}

// ── Renderização ─────────────────────────────────────────────

function renderItems() {
  const area = document.getElementById('itemsArea');
  if (!area) return;

  if (!items.length) {
    area.innerHTML = `
      <tr><td colspan="12" class="po-empty">
        <div class="po-empty-icon">📋</div>
        <div class="po-empty-title">Nenhum item na Nota Fiscal</div>
        <div>Importe produtos da PO ou adicione manualmente</div>
      </td></tr>`;
    _updateSummary();
    return;
  }

  area.innerHTML = items.map((it, i) => {
    const total = it.qtd * it.unit;
    return `
    <tr>
      <td style="text-align:center;color:var(--text3);font-size:11px">${i + 1}</td>
      <td>
        <input class="nf-inp-desc" value="${esc(it.desc)}" placeholder="Descrição do produto"
          onchange="items[${i}].desc=this.value"
          style="width:100%;font-size:12px;padding:5px 7px;border:1px solid var(--border);border-radius:5px;background:var(--bg3);color:var(--text);font-family:inherit"/>
      </td>
      <td class="td-code">${it.cod || ''}</td>
      <td>${it.cfop || '5.102'}</td>
      <td>${it.un || ''}</td>
      <td class="td-code">${it.sku || ''}</td>
      <td class="td-code">${it.barcode || ''}</td>
      <td class="td-r">R$ ${fmtN(it.unit)}</td>
      <td class="td-r">${it.qtyPerUnit || '—'}</td>
      <td>
        <div class="qty-cell">
          <button class="qty-btn" onclick="nfChangeQty(${i},-1)">−</button>
          <input class="qty-input" type="text" inputmode="decimal"
            id="nf-qty-${i}" value="${it.qtd}"
            onchange="nfSetQty(${i},this.value)"
            oninput="nfSetQty(${i},this.value)"/>
          <button class="qty-btn" onclick="nfChangeQty(${i},+1)">+</button>
        </div>
      </td>
      <td class="td-r" style="font-weight:600;color:var(--green)" id="nf-total-${i}">R$ ${fmtN(total)}</td>
      <td style="text-align:center">
        <button class="rm-btn" onclick="removeItem(${i})" title="Remover">×</button>
      </td>
    </tr>`;
  }).join('');

  _updateSummary();
}

// ── Controles de quantidade ──────────────────────────────────

function nfSetQty(i, val) {
  const n = parseNum(val);
  items[i].qtd = n > 0 ? n : 1;
  _updateLineTotal(i);
}

function nfChangeQty(i, delta) {
  const next = Math.max(1, (items[i].qtd || 1) + delta);
  items[i].qtd = next;

  const inp = document.getElementById('nf-qty-' + i);
  if (inp) inp.value = next;

  _updateLineTotal(i);
}

// ── Limpar itens ─────────────────────────────────────────────

function confirmClearItems() {
  if (!items.length) return;

  showConfirm('Limpar itens da NF', 'Todos os itens serão removidos.', () => {
    items = [];
    renderItems();
    updateNFBadge();
    regenerateNFData();
    toast('Itens removidos. Novos dados da NF gerados.', 'info');
  });
}

// ── Helpers internos ─────────────────────────────────────────

function _updateLineTotal(i) {
  const cell = document.getElementById('nf-total-' + i);
  if (!cell) return;
  cell.textContent = 'R$ ' + fmtN(items[i].qtd * items[i].unit);
  _updateSummary();
}

function _updateSummary() {
  const total = items.reduce((s, it) => s + it.qtd * it.unit, 0);

  const ce = document.getElementById('summCount');
  const te = document.getElementById('summTotal');
  if (ce) ce.textContent = items.length;
  if (te) te.textContent = 'R$ ' + fmtN(total);

  updateNFBadge();
}

function updateNFBadge() {
  // Badge na sub-tab Invoice LI
  const b = document.getElementById('nf-badge');
  if (b) {
    b.textContent   = items.length;
    b.style.display = items.length > 0 ? '' : 'none';
  }

  // Badge na top-tab Invoice
  const topBadge = document.getElementById('invoice-top-badge');
  if (topBadge) {
    topBadge.textContent   = items.length;
    topBadge.style.display = items.length > 0 ? '' : 'none';
  }

  const gen = document.getElementById('btn-generate-invoice');
  if (gen) gen.disabled = false;
}
