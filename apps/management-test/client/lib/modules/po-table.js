// ============================================================
//  po-table.js — Tabela de Purchase Order
//
//  Responsabilidade: renderizar tabela de produtos para PO,
//  gerenciar seleção, quantidades, importar para NF,
//  criar PO/Invoice no Salesforce.
//  Dependências: state.js, helpers.js, nf-key.js, nf-items.js
// ============================================================

// ── Renderização da tabela PO ────────────────────────────────

async function poRender() {
  const filtered = _poCurrentList();
  const tbody    = document.getElementById('po-body');
  if (!tbody) return;

  document.getElementById('po-count-lbl').textContent =
    filtered.length + ' produto' + (filtered.length !== 1 ? 's' : '');

  _renderPoTableHeader();

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="11" class="po-empty">
        <div class="po-empty-icon">🔍</div>
        <div class="po-empty-title">Nenhum produto encontrado</div>
        <div>Clique em "↻ Atualizar produtos" para buscar do SF</div>
      </td></tr>`;
    _poUpdateFooter();
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const k    = _poKey(p);
    const st   = STATE.poState[k] || { qty: 1, selected: false };
    const cost = p.last_cost ?? p.unit ?? 0;
    const sub  = st.qty * cost;
    const qtyUn = getQtyPerUnit(p);

    return `
    <tr class="${st.selected ? 'po-selected' : ''}" id="po-row-${k}">
      <td class="td-chk">
        <label class="chk-wrap">
          <input type="checkbox" ${st.selected ? 'checked' : ''}
            onchange="poToggleRow('${k}',this.checked)"/>
          <span class="chk-box"></span>
        </label>
      </td>
      <td title="${esc(p.desc)}">${p.desc}</td>
      <td class="td-code">${p.cod || ''}</td>
      <td>${p.cfop || '5.102'}</td>
      <td>${p.un || p.uom || ''}</td>
      <td class="td-code">${p.sku || ''}</td>
      <td class="td-code">${p.barcode || ''}</td>
      <td class="td-r">R$ ${fmtN(cost)}</td>
      <td class="td-r">${qtyUn}</td>
      <td>
        <div class="qty-cell">
          <button class="qty-btn" onclick="poChangeQty('${k}',-1)">−</button>
          <input class="qty-input" type="text" inputmode="decimal"
            id="qty-${k}" value="${st.qty}"
            onchange="poSetQty('${k}',this.value)"
            oninput="poSetQty('${k}',this.value)"/>
          <button class="qty-btn" onclick="poChangeQty('${k}',+1)">+</button>
        </div>
      </td>
      <td class="td-sub">R$ ${fmtN(sub)}</td>
    </tr>`;
  }).join('');

  _poUpdateFooter();
  _poUpdateChkAll(filtered);
}

// ── Helpers internos da tabela ────────────────────────────────

const _poKey = p => p.sfId || p.productId || p.cod;

function _poCurrentList() {
  const q = (document.getElementById('prod-search')?.value || '').toLowerCase().trim();
  if (!STATE.products || !Array.isArray(STATE.products)) return [];

  return STATE.products.filter(p => {
    if (!p) return false;
    if (!q) return true;
    return (p.desc || '').toLowerCase().includes(q) ||
           (p.cod || '').toLowerCase().includes(q) ||
           (p.sku || '').toLowerCase().includes(q);
  });
}

function _renderPoTableHeader() {
  const thead = document.getElementById('po-thead');
  if (!thead) return;
  thead.innerHTML = `<tr>
    <th class="th-chk">
      <label class="chk-wrap">
        <input type="checkbox" id="chk-all" onchange="poToggleAll(this.checked)"/>
        <span class="chk-box"></span>
      </label>
    </th>
    <th style="min-width:180px">Produto</th>
    <th>Name Vendor Produto</th>
    <th>CFOP</th>
    <th>UN</th>
    <th>SKU</th>
    <th>Barcode</th>
    <th class="th-r">Último custo</th>
    <th class="th-r">QTD/UN</th>
    <th class="th-qty">Quantidade</th>
    <th class="th-r">Subtotal</th>
  </tr>`;
}

function _poUpdateSubCell(key) {
  const row = document.getElementById('po-row-' + key);
  if (!row) return;

  const p  = STATE.products.find(x => _poKey(x) === key);
  const st = STATE.poState[key];
  if (!p || !st) return;

  const cost = p.last_cost ?? p.unit ?? 0;
  const cell = row.querySelector('.td-sub');
  if (!cell) return;

  cell.textContent = 'R$ ' + fmtN(st.qty * cost);
  cell.className   = 'td-sub';
}

function _poUpdateFooter() {
  const sel   = STATE.products.filter(p => STATE.poState[_poKey(p)]?.selected);
  const count = sel.length;
  const total = sel.reduce((s, p) => {
    const st = STATE.poState[_poKey(p)];
    return s + (st?.qty || 1) * (p.last_cost ?? p.unit ?? 0);
  }, 0);

  const sl = document.getElementById('po-sel-lbl');
  const te = document.getElementById('po-total');
  if (sl) sl.textContent = count > 0 ? count + ' selecionado' + (count > 1 ? 's' : '') : 'Nenhum selecionado';
  if (te) te.textContent = 'R$ ' + fmtN(total);

  _poUpdateBtnImport();
}

function _poUpdateBtnImport() {
  const count = STATE.products.filter(p => STATE.poState[_poKey(p)]?.selected).length;

  const btn     = document.getElementById('btn-import');
  const btnPO   = document.getElementById('btn-save-po');
  const btnPOOnly = document.getElementById('btn-save-po-only');
  const bdg     = document.getElementById('import-badge');

  if (btn)       btn.disabled     = count === 0;
  if (btnPO)     btnPO.disabled   = count === 0;
  if (btnPOOnly) btnPOOnly.disabled = count === 0;
  if (bdg)       bdg.textContent  = count;
}

function _poUpdateChkAll(list) {
  const el = document.getElementById('chk-all');
  if (!el || !list.length) return;

  const n = list.filter(p => STATE.poState[_poKey(p)]?.selected).length;
  el.indeterminate = n > 0 && n < list.length;
  el.checked       = n === list.length && list.length > 0;
}

// ── Ações do usuário na tabela ───────────────────────────────

function poFilter() { poRender(); }

function poToggleRow(key, checked) {
  if (!STATE.poState[key]) STATE.poState[key] = { qty: 1, selected: false };
  STATE.poState[key].selected = checked;

  document.getElementById('po-row-' + key)?.classList.toggle('po-selected', checked);
  _poUpdateSubCell(key);
  _poUpdateFooter();
  _poUpdateChkAll(_poCurrentList());
}

function poSetQty(key, val) {
  if (!STATE.poState[key]) STATE.poState[key] = { qty: 1, selected: false };
  const n = parseNum(val);
  STATE.poState[key].qty = n > 0 ? n : 1;
  _poUpdateSubCell(key);
  _poUpdateFooter();
}

function poChangeQty(key, delta) {
  if (!STATE.poState[key]) STATE.poState[key] = { qty: 1, selected: false };

  const next = Math.max(1, (STATE.poState[key].qty || 1) + delta);
  STATE.poState[key].qty = next;

  const inp = document.getElementById('qty-' + key);
  if (inp) inp.value = next;

  _poUpdateSubCell(key);
  _poUpdateFooter();
}

function poToggleAll(checked) {
  _poCurrentList().forEach(p => {
    const k = _poKey(p);
    if (!STATE.poState[k]) STATE.poState[k] = { qty: 1, selected: false };
    STATE.poState[k].selected = checked;
  });
  poRender();
}

function poSelectAll() { poToggleAll(true); }

function poDeselectAll() {
  poToggleAll(false);

  // Desmarca UOM chips
  document.querySelectorAll('#uom-group input[type=checkbox]').forEach(cb => cb.checked = false);
  document.querySelectorAll('.uom-chip').forEach(chip => chip.classList.remove('active'));

  STATE.products = [];
  STATE.poState  = {};
  if (STATE.vendor) fetchVendorProducts();
}

function confirmClearPO() {
  showConfirm('Limpar Purchase Order',
    'Desseleciona todos os produtos e redefine quantidades.',
    () => {
      STATE.products.forEach(p => {
        STATE.poState[_poKey(p)] = { qty: 1, selected: false };
      });
      poRender();
      toast('PO limpa.', 'info');
    }
  );
}

// ── Importar para NF ─────────────────────────────────────────

function poImport() {
  const sel = _getSelectedProducts();
  if (!sel.length) { toast('Selecione ao menos um produto.', 'err'); return; }

  sel.forEach(p => {
    const k    = _poKey(p);
    const st   = STATE.poState[k];
    const qty  = st?.qty || 1;
    const cost = p.last_cost ?? p.unit ?? 0;
    const idx  = items.findIndex(it => (it.productId || it.cod) === (p.productId || p.sfId || p.cod));

    if (idx >= 0) {
      items[idx].qtd  = qty;
      items[idx].unit = cost;
    } else {
      items.push({
        cod:        p.cod || '',
        desc:       p.desc,
        ncm:        p.ncm || '',
        cfop:       p.cfop || '5.102',
        un:         p.un || p.uom || '',
        qtd:        qty,
        unit:       cost,
        sku:        p.sku || '',
        barcode:    p.barcode || '',
        productId:  p.productId || '',
        qtyPerUnit: getQtyPerUnit(p),
      });
    }
  });

  renderItems();
  updateNFBadge();
  toast(`${sel.length} produto(s) importado(s) para a NF!`, 'ok');
}

// ── Criar PO + Invoice no Salesforce ─────────────────────────

async function savePOandInvoice() {
  const sel = _getSelectedProducts();
  if (!sel.length) { toast('Selecione produtos antes de criar a PO.', 'err'); return; }
  if (!STATE.vendor || !STATE.hub) { toast('Selecione HUB e Vendor.', 'err'); return; }
  if (!STATE.vendor.sf_account_id) {
    toast('Vendor sem SF Account ID. Edite o vendor na aba Vendors e preencha o campo.', 'err');
    return;
  }

  renderApiStatus('loading', 'Verificando autenticação…');
  const authed = await authCheck(false);
  if (!authed) {
    toast('Falha na autenticação com o Salesforce. Verifique o .env.', 'err');
    return;
  }

  const cnpjRaw = STATE.vendor.cnpj.replace(/\D/g, '');
  const keyData = generateAccessKey(cnpjRaw);

  _updateNFKeyFields(keyData);

  renderApiStatus('loading', 'Criando PO no Salesforce…');
  const btnSave = document.getElementById('btn-save-po');
  if (btnSave) { btnSave.disabled = true; btnSave.textContent = '⏳ Criando PO…'; }

  try {
    const products = _mapSelectedToPayload(sel);

    const res = await fetch('/api/po/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sfAccountId: STATE.vendor.sf_account_id,
        hubName:     STATE.hub.name,
        cnpj:        cnpjRaw,
        vendorName:  STATE.vendor.name,
        uom:         getSelectedUoms()[0] || 'ea',
        nNF:         keyData.nNF,
        accessKey:   keyData.accessKey,
        products,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data.error || data));

    await _handlePOSuccess(data, keyData, products, sel);
    toast(`✅ PO criada: ${data.poId} | ${data.poliCount} itens`, 'ok');

    // Importa para Invoice e gera DANFE
    _importProductsToNF(products, sel);
    renderItems();
    updateNFBadge();
    renderDANFE();
    toast('Invoice gerada! Acesse a aba Invoice para exportar.', 'ok');

  } catch (e) {
    renderApiStatus('error', 'Erro ao criar PO: ' + e.message);
    toast('Erro: ' + e.message, 'err');
    console.error('[savePOandInvoice]', e);
  } finally {
    if (btnSave) { btnSave.disabled = false; btnSave.textContent = '⬆ Criar PO + NF'; }
  }
}

// ── Criar PO (sem Invoice) ───────────────────────────────────

async function savePOOnly() {
  const sel = _getSelectedProducts();
  if (!sel.length) { toast('Selecione produtos antes de criar a PO.', 'err'); return; }
  if (!STATE.vendor || !STATE.hub) { toast('Selecione HUB e Vendor.', 'err'); return; }
  if (!STATE.vendor.sf_account_id) {
    toast('Vendor sem SF Account ID. Edite o vendor na aba Vendors e preencha o campo.', 'err');
    return;
  }

  renderApiStatus('loading', 'Verificando autenticação…');
  const authed = await authCheck(false);
  if (!authed) {
    toast('Falha na autenticação com o Salesforce. Verifique o .env.', 'err');
    return;
  }

  renderApiStatus('loading', 'Criando PO no Salesforce…');
  const btnSave = document.getElementById('btn-save-po-only') || document.getElementById('btn-create-po-only');
  if (btnSave) { btnSave.disabled = true; btnSave.textContent = '⏳ Criando PO…'; }

  try {
    const products = _mapSelectedToPayload(sel);

    const res = await fetch('/api/po/create-only', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sfAccountId: STATE.vendor.sf_account_id,
        hubName:     STATE.hub.name,
        vendorName:  STATE.vendor.name,
        uom:         getSelectedUoms()[0] || 'ea',
        products,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data.error || data));

    await _handlePOOnlySuccess(data, products);
    toast(`✅ PO criada: ${data.poId} | ${data.poliCount} itens`, 'ok');
    setTimeout(() => toast('⚠️ Nota: Invoice não criada para este PO (criado somente a PO)', 'warn'), 600);

    await fetchVendorProducts();

  } catch (e) {
    renderApiStatus('error', 'Erro ao criar PO: ' + e.message);
    toast('Erro: ' + e.message, 'err');
    console.error('[savePOOnly]', e);
  } finally {
    if (btnSave) { btnSave.disabled = false; btnSave.textContent = '⬆ Criar PO (sem NF)'; }
  }
}

// ── Helpers privados ─────────────────────────────────────────

function _getSelectedProducts() {
  return STATE.products.filter(p => STATE.poState[_poKey(p)]?.selected);
}

function _mapSelectedToPayload(sel) {
  return sel.map(p => {
    const st = STATE.poState[_poKey(p)];
    return {
      productId: p.productId || '',
      sku:       p.sku       || '',
      barcode:   p.barcode   || '',
      qty:       st?.qty     || 1,
      last_cost: p.last_cost ?? p.unit ?? 0,
      uom:       p.uom       || p.un   || 'ea',
      desc:      p.desc,
    };
  });
}

function _updateNFKeyFields(keyData) {
  const elChave = document.getElementById('nfChave');
  const elNum   = document.getElementById('nfNum');
  const elProto = document.getElementById('nfProtocolo');
  if (elChave) elChave.value = keyData.accessKey;
  if (elNum)   elNum.value   = keyData.nNF.slice(0, 6);
  if (elProto) elProto.value = String(Math.floor(Math.random() * 1e15)).padStart(15, '0');
}

async function _handlePOSuccess(data, keyData, products) {
  renderApiStatus('ok', `PO: ${data.poId} | Invoice: ${data.invoiceId}`);

  const lastPoEl = document.getElementById('api-last-po');
  if (lastPoEl) {
    const base = await ensureSfBase();
    if (base) {
      const baseUrl = base.replace(/\/$/, '');
      let html = `<a href="${baseUrl}/lightning/r/Purchase_Order__c/${data.poId}/view" target="_blank" rel="noopener">PO: ${data.poId}</a>`;
      if (data.invoiceId) {
        html += ` &middot; <a href="${baseUrl}/lightning/r/Invoice__c/${data.invoiceId}/view" target="_blank" rel="noopener">Invoice: ${data.invoiceId}</a>`;
      }
      lastPoEl.innerHTML = html;
    } else {
      lastPoEl.textContent = data.invoiceId
        ? `PO: ${data.poId} · Invoice: ${data.invoiceId}`
        : `PO: ${data.poId}`;
    }
  }

  await DB.savePO({
    hub_id:      STATE.hub.id,
    hub_name:    STATE.hub.name,
    vendor_id:   STATE.vendor.id,
    vendor_name: STATE.vendor.name,
    po_id_sf:    data.poId,
    invoice_id:  data.invoiceId,
    nf_key:      keyData.accessKey,
    nf_num:      keyData.nNF,
    items:       products,
  });
}

async function _handlePOOnlySuccess(data, products) {
  renderApiStatus('ok', `PO: ${data.poId} (sem Invoice)`);

  const lastPoEl = document.getElementById('api-last-po');
  if (lastPoEl) {
    const base = await ensureSfBase();
    if (base) {
      const url = base.replace(/\/$/, '') + `/lightning/r/Purchase_Order__c/${data.poId}/view`;
      lastPoEl.innerHTML = `<a href="${url}" target="_blank" rel="noopener">PO: ${data.poId}</a>`;
    } else {
      lastPoEl.textContent = `PO: ${data.poId}`;
    }
  }

  await DB.savePO({
    hub_id:      STATE.hub.id,
    hub_name:    STATE.hub.name,
    vendor_id:   STATE.vendor.id,
    vendor_name: STATE.vendor.name,
    po_id_sf:    data.poId,
    invoice_id:  null,
    nf_key:      null,
    nf_num:      null,
    items:       products,
  });
}

function _importProductsToNF(products, sel) {
  products.forEach((p, idx) => {
    const prod     = sel[idx];
    const existIdx = items.findIndex(it => it.productId === p.productId);

    if (existIdx >= 0) {
      items[existIdx].qtd  = p.qty;
      items[existIdx].unit = p.last_cost;
    } else {
      items.push({
        cod:        prod.cod || '',
        desc:       prod.desc,
        ncm:        prod.ncm  || '',
        cfop:       prod.cfop || '5.102',
        un:         prod.un   || prod.uom || '',
        qtd:        p.qty,
        unit:       p.last_cost,
        sku:        p.sku     || '',
        barcode:    p.barcode || '',
        productId:  p.productId,
        qtyPerUnit: getQtyPerUnit(prod),
      });
    }
  });
}
