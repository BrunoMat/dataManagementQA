// ============================================================
//  hubr.js — HUBR Hub Operations
//  Abas: Coleta (SO) | Transfer Order | Gestão de Estoque | Config
//  Navegação bidirecional com RAIO e TRADE
// ============================================================

// Context compartilhado entre módulos
const HUBR_CTX = { lastDelivery: null };

function hubrInit() { setHubrTab('coleta'); }

function setHubrTab(tab) {
  ['coleta','to','estoque','config'].forEach(t => {
    const el = document.getElementById('hubr-tab-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('#hubr-tabs-bar .top-tab').forEach((btn, i) => {
    btn.classList.toggle('active', ['coleta','to','estoque','config'][i] === tab);
  });
}

function setHubrSoSub(sub) {
  ['criar','kanban'].forEach(s => {
    const el = document.getElementById('hubr-so-sub-' + s);
    if (el) el.style.display = s === sub ? '' : 'none';
  });
  document.querySelectorAll('#hubr-so-subtabs .sub-tab').forEach((btn, i) => {
    btn.classList.toggle('active', ['criar','kanban'][i] === sub);
  });
}

function _hubrUrl() { return document.getElementById('hubr-gql-url')?.value || ''; }

async function _hubrGql(query, variables, operationName) {
  const res = await fetch('/api/hubr/graphql', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables, operationName, _url: _hubrUrl() }),
  });
  const data = await res.json();
  if (data.errors?.length) throw new Error(data.errors.map(e => e.message).join('; '));
  return data;
}

function _hubrJson(data, type) {
  const c = type === 'ok' ? 'var(--green)' : type === 'err' ? 'var(--red)' : 'var(--text2)';
  return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px;max-height:300px;overflow:auto">
    <pre style="font-size:10px;color:${c};margin:0;white-space:pre-wrap;word-break:break-all">${esc(JSON.stringify(data,null,2))}</pre></div>`;
}

// ══════════════════════════════════════════════════════════════
//  NAVEGAÇÃO BIDIRECIONAL
// ══════════════════════════════════════════════════════════════

// HUBR → RAIO (leva hub preenchido)
function hubrGoToRaio() {
  const hub = document.getElementById('hubr-so-hub')?.value || 'SAO022';
  goModule('rops');
  // Preenche o hub no RAIO
  const ropsHub = document.getElementById('rops-hub-id');
  if (ropsHub) ropsHub.value = hub;
}

// HUBR → TRADE
function hubrGoToTrade() { goModule('trade'); }

// Chamado pelo RAIO após criar delivery — volta para HUBR com dados
function hubrReceiveDelivery(deliveryData) {
  HUBR_CTX.lastDelivery = deliveryData;
  goModule('hubr');
  setHubrTab('coleta');
  // Mostra info da delivery criada
  const wrap = document.getElementById('hubr-so-actions-wrap');
  const info = document.getElementById('hubr-so-actions-info');
  if (wrap && info && deliveryData) {
    wrap.style.display = '';
    const d = deliveryData.delivery || deliveryData;
    const raio = `https://raio.staging.soudaki.com/deliveries/details/?deliveryId=${d.id}`;
    info.innerHTML = `<div class="rsv-result-ok">
      <strong>Delivery pronta para coleta</strong>
      <div class="rsv-tags">
        <span class="rsv-tag">ID: ${d.id||'—'}</span>
        <span class="rsv-tag">Hub: ${d.external_hub_id||'—'}</span>
        <span class="rsv-tag">Cliente: ${d.customer?.name||'—'}</span>
        <span class="rsv-tag">${(d.line_items||[]).length} item(s)</span>
      </div>
      <div style="margin-top:6px"><a href="${raio}" target="_blank" rel="noopener" style="font-size:11px;color:var(--accent)">🔗 Ver no Raio</a></div>
    </div>`;
  }
}

// ══════════════════════════════════════════════════════════════
//  COLETA (SO) — Criar Delivery + Limpar Kanban
// ══════════════════════════════════════════════════════════════

async function hubrCreateDelivery() {
  const hubId = document.getElementById('hubr-so-hub')?.value?.trim() || 'SAO022';
  const skusRaw = document.getElementById('hubr-so-skus')?.value?.trim();
  const qty = parseInt(document.getElementById('hubr-so-qty')?.value) || 1;
  const el = document.getElementById('hubr-so-delivery-result');

  if (!skusRaw) { toast('Informe pelo menos um SKU.', 'err'); return; }

  const skus = skusRaw.split(',').map(s => s.trim()).filter(Boolean);
  const lineItems = skus.map(sku => ({
    sku, name: sku, description: sku, amount: qty,
    location: '', salesforce_id: '', barcodes: [], image_url: '', tags: [],
  }));

  const names = ['Ana','Bruno','Carlos','Daniela','Eduardo','Fernanda','Gabriel','Helena','Igor','Julia'];
  const lasts = ['Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira','Alves','Pereira'];
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const customerName = pick(names) + ' ' + pick(lasts);

  const now = new Date();
  const delivery = {
    external_hub_id: hubId,
    external_delivery_id: `test000-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    confirmed_at: now.toISOString(), estimated_to: now.toISOString(),
    eta_min: new Date(now.getTime()+75*60000).toISOString(),
    eta_max: new Date(now.getTime()+90*60000).toISOString(),
    address: { formatted:'R. Rosalia Sandoval 51', lat:-23.5985657, lng:-46.5492498, street:'R. Rosalia Sandoval', number:'51', complement:'', neighborhood:'Jardim Avelino', city:'São Paulo' },
    customer: { external_customer_id:'', name:customerName, orders_count:10, phone:'11999999999' },
    line_items: lineItems,
    config: { webhook:'https://api.staging.soudaki.com/webhook', delivery_code:null, dispatch:true, type:'instant', assortment_type:'core', note:'', tasks:{verify_document:false,receive_payment:false} },
  };

  if (el) el.innerHTML = '<span class="spinner-sm"></span> <span style="font-size:11px">Criando…</span>';

  try {
    const res = await fetch('/api/rops/deliveries', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({delivery}) });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data.error||data));

    const d = data.delivery||{};
    HUBR_CTX.lastDelivery = data;
    const raio = `https://raio.staging.soudaki.com/deliveries/details/?deliveryId=${d.id}`;

    // Auto-fill pick section with external delivery ID
    const pickExtId = document.getElementById('hubr-so-pick-extid');
    if (pickExtId) pickExtId.value = delivery.external_delivery_id;

    if (el) el.innerHTML = `<div class="rsv-result-ok">
      <strong>Delivery criada!</strong>
      <div class="rsv-tags"><span class="rsv-tag">ID: ${d.id||'—'}</span><span class="rsv-tag">${customerName}</span><span class="rsv-tag">${hubId}</span><span class="rsv-tag">${skus.length} item(s)</span></div>
      <div style="margin-top:6px"><a href="${raio}" target="_blank" rel="noopener" style="font-size:11px;color:var(--accent)">🔗 Ver no Raio</a></div>
    </div>`;

    // Mostra painel de ações
    const wrap = document.getElementById('hubr-so-actions-wrap');
    const info = document.getElementById('hubr-so-actions-info');
    if (wrap && info) {
      wrap.style.display = '';
      info.innerHTML = `<div style="font-size:12px;color:var(--text2)">
        <p>Delivery <strong>${d.id}</strong> criada. External ID preenchido no Step 2 para realizar o pick.</p>
      </div>`;
    }

    toast(`✅ Delivery ${d.id} criada!`, 'ok');
  } catch (e) {
    if (el) el.innerHTML = _hubrJson({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

async function hubrClearKanban() {
  const hubId = parseInt(document.getElementById('hubr-so-hub-num')?.value) || 107;
  const el = document.getElementById('hubr-kanban-result');
  try {
    const res = await fetch('/api/hubr/clear-kanban', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({hubId}) });
    const data = await res.json();
    if (el) el.innerHTML = _hubrJson(data, res.ok ? 'ok' : 'err');
    toast(res.ok ? `🧹 Kanban hub ${hubId} limpo!` : 'Erro', res.ok ? 'ok' : 'err');
  } catch (e) {
    if (el) el.innerHTML = _hubrJson({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

// ══════════════════════════════════════════════════════════════
//  TRANSFER ORDER — Buscar Movements
// ══════════════════════════════════════════════════════════════

async function hubrGetMovementsTO() {
  const origin = document.getElementById('hubr-to-origin')?.value?.trim() || '';
  const dest = document.getElementById('hubr-to-dest')?.value?.trim() || '';
  const el = document.getElementById('hubr-to-movements-result');

  const query = `query GetMovementsForPicking($currentPage: Int, $originHubId: String, $hubDestinationId: String, $referenceId: String) {
    getMovementsForPicking(currentPage: $currentPage, originHubId: $originHubId, hubDestinationId: $hubDestinationId, referenceId: $referenceId) {
      movements { id status referenceId originHubId hubDestinationId lineItems { id sku amount } } total currentPage
    }
  }`;

  try {
    const data = await _hubrGql(query, { currentPage:1, originHubId:origin, hubDestinationId:dest, referenceId:'' }, 'GetMovementsForPicking');
    const movements = data.data?.getMovementsForPicking?.movements || [];
    if (el) {
      if (movements.length) {
        el.innerHTML = `<div style="font-size:11px;color:var(--text3);margin-bottom:6px">${movements.length} movement(s)</div>
        <div style="max-height:300px;overflow:auto">${movements.map(m => `
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 12px;margin-bottom:6px">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
              <span style="font-family:var(--font-mono);font-size:10px;font-weight:700;cursor:pointer" onclick="navigator.clipboard.writeText('${m.id}');toast('ID copiado!','ok')" title="Clique para copiar">${esc(m.id)}</span>
              <span class="dh-badge" style="background:var(--accent-dim);border-color:var(--accent);color:var(--accent);font-size:9px">${m.status}</span>
            </div>
            <div style="font-size:10px;color:var(--text3)">${(m.lineItems||[]).length} items · ${m.originHubId} → ${m.hubDestinationId||'—'}</div>
            <div style="font-size:9px;color:var(--text3);margin-top:2px">Ref: ${m.referenceId||'—'}</div>
          </div>`).join('')}</div>`;
      } else {
        el.innerHTML = `<div style="font-size:11px;color:var(--amber)">Nenhum movement encontrado</div>`;
      }
    }
    toast(`🔍 ${movements.length} movements`, 'ok');
  } catch (e) {
    if (el) el.innerHTML = _hubrJson({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

// ══════════════════════════════════════════════════════════════
//  GESTÃO DE ESTOQUE — Inventário + Processos + Invoice
// ══════════════════════════════════════════════════════════════

async function hubrListInventory() {
  const hub = document.getElementById('hubr-est-hub')?.value?.trim() || 'SAO022';
  const sku = document.getElementById('hubr-est-sku')?.value?.trim();
  const limit = parseInt(document.getElementById('hubr-est-limit')?.value) || 20;
  const el = document.getElementById('hubr-inv-result');

  const query = `query GetProductInventory($hubId: String!, $skus: [String!], $limit: Int, $sorting: Sorting, $active: Boolean) {
    warehouseProductInventories(hubId: $hubId, skus: $skus, limit: $limit, sorting: $sorting, active: $active) {
      total products { sku name ean warehouseProductId locations { name quantity state } }
    }
  }`;
  const variables = { hubId:hub, limit, sorting:{field:'name',direction:'Ascendent'}, active:true };
  if (sku) variables.skus = sku.split(',').map(s => s.trim());

  try {
    const data = await _hubrGql(query, variables, 'GetProductInventory');
    const products = data.data?.warehouseProductInventories?.products || [];
    const total = data.data?.warehouseProductInventories?.total || 0;

    if (el) {
      if (products.length) {
        el.innerHTML = `<div style="font-size:11px;color:var(--text3);margin-bottom:6px">${total} produto(s)</div>
        <div style="max-height:300px;overflow:auto"><table class="po-table" style="min-width:600px"><thead><tr>
          <th>SKU</th><th>Nome</th><th>EAN</th><th>Locations</th><th>WP ID</th>
        </tr></thead><tbody>${products.map(p => `<tr>
          <td style="font-family:var(--font-mono);font-size:11px">${esc(p.sku)}</td>
          <td>${esc(p.name||'—')}</td>
          <td style="font-size:10px">${esc(p.ean||'—')}</td>
          <td style="font-size:10px">${(p.locations||[]).map(l => `${l.name}:${l.quantity}(${l.state})`).join(', ')||'—'}</td>
          <td style="font-family:var(--font-mono);font-size:9px;cursor:pointer;max-width:140px;overflow:hidden;text-overflow:ellipsis" title="Clique para copiar e usar nos processos" onclick="document.getElementById('hubr-process-wpid').value='${esc(p.warehouseProductId||'')}';toast('WP ID copiado!','ok')">${esc(p.warehouseProductId||'—')}</td>
        </tr>`).join('')}</tbody></table></div>
        <div style="font-size:10px;color:var(--text3);margin-top:4px">Clique no WP ID para copiar e usar nos processos abaixo</div>`;
      } else {
        el.innerHTML = `<div style="font-size:11px;color:var(--amber)">Nenhum produto encontrado</div>`;
      }
    }
    toast(`📦 ${total} produtos`, 'ok');
  } catch (e) {
    if (el) el.innerHTML = _hubrJson({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

async function hubrProcessTask() {
  const kind = document.getElementById('hubr-process-kind')?.value;
  const wpId = document.getElementById('hubr-process-wpid')?.value?.trim();
  const qty = parseInt(document.getElementById('hubr-process-qty')?.value) || 1;
  const loc = document.getElementById('hubr-process-location')?.value?.trim() || 'A-1-1-1';
  const hub = document.getElementById('hubr-est-hub')?.value?.trim() || 'SAO022';
  const shopper = document.getElementById('hubr-est-shopper')?.value?.trim() || '212121212121';
  const el = document.getElementById('hubr-process-result');

  if (!wpId) { toast('Informe o Warehouse Product ID (clique no WP ID da tabela acima).', 'err'); return; }

  let query;
  if (kind === 'cycle_count') {
    const before = parseInt(document.getElementById('hubr-before-total')?.value) || 0;
    const after = parseInt(document.getElementById('hubr-after-total')?.value) || qty;
    query = `mutation ProcessCycleCountTask($shopperCode:String!,$hubId:String!,$warehouseProductId:String!,$location:String!,$amount:Int!,$beforeTotal:Int!,$afterTotal:Int!) {
      processTaskGeneric(input:{kind:cycle_count,shopperCode:$shopperCode,hubId:$hubId,data:{cycleCount:{items:[{warehouseProductId:$warehouseProductId,location:$location,amount:$amount,beforeTotal:$beforeTotal,afterTotal:$afterTotal}]}}}) { id kind status hubId }
    }`;
    try {
      const data = await _hubrGql(query, { shopperCode:shopper, hubId:hub, warehouseProductId:wpId, location:loc, amount:qty, beforeTotal:before, afterTotal:after }, 'ProcessCycleCountTask');
      if (el) el.innerHTML = _hubrJson(data.data||data, 'ok');
      toast('✅ Cycle count executado!', 'ok');
    } catch (e) {
      if (el) el.innerHTML = _hubrJson({ error: e.message }, 'err');
      toast('Erro: ' + e.message, 'err');
    }
    return;
  }

  const fields = {
    inventory_move: `inventoryMove:{items:[{warehouseProductId:"${wpId}",sourceLocationName:"${loc}",destinationLocationName:"${loc}",amount:${qty}}]}`,
    inventory_adjustment: `inventoryAdjustment:{items:[{warehouseProductId:"${wpId}",locationName:"${loc}",amount:${qty}}]}`,
    waste: `waste:{items:[{warehouseProductId:"${wpId}",amount:${-Math.abs(qty)},beforeExpiration:false,reason:"damaged"}]}`,
    move_between_product_kind: `moveBetweenProductKind:{items:[{warehouseProductId:"${wpId}",locationName:"${loc}",amount:${qty}}]}`,
  };

  query = `mutation{processTaskGeneric(input:{kind:${kind},shopperCode:"${shopper}",hubId:"${hub}",data:{${fields[kind]}}}){id kind status hubId}}`;

  try {
    const data = await _hubrGql(query);
    if (el) el.innerHTML = _hubrJson(data.data||data, 'ok');
    toast(`✅ ${kind} executado!`, 'ok');
  } catch (e) {
    if (el) el.innerHTML = _hubrJson({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

async function hubrValidateInvoice() {
  const key = document.getElementById('hubr-invoice-key')?.value?.trim();
  const hub = document.getElementById('hubr-est-hub')?.value?.trim() || 'SAO022';
  const el = document.getElementById('hubr-validate-result');
  if (!key) { toast('Informe a chave de acesso.', 'err'); return; }

  const query = `query ValidateInvoice($input:ValidateInvoiceInput!){validateInvoice(input:$input){isValid invoiceAccessKey kind roomTemperature frozen refrigerated chilled frozenRangeTemperature{min max} refrigeratedRangeTemperature{min max} chilledRangeTemperature{min max}}}`;

  try {
    const data = await _hubrGql(query, { input:{ hubId:hub, invoiceAccessKey:key }}, 'ValidateInvoice');
    const r = data.data?.validateInvoice;
    if (el) el.innerHTML = _hubrJson(r||data, r?.isValid ? 'ok' : 'err');
    toast(r?.isValid ? '✅ Invoice válida!' : '❌ Invoice inválida', r?.isValid ? 'ok' : 'err');
  } catch (e) {
    if (el) el.innerHTML = _hubrJson({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

// ══════════════════════════════════════════════════════════════
//  CONFIG — Setup Warehouse
// ══════════════════════════════════════════════════════════════

async function hubrSetupWarehouse() {
  const hub = document.getElementById('hubr-cfg-hub')?.value?.trim() || 'SAO022';
  const el = document.getElementById('hubr-setup-result');
  try {
    const data = await _hubrGql(`mutation SetupWarehouse($hubId:String!){setupWarehouse(hubId:$hubId)}`, { hubId:hub }, 'SetupWarehouse');
    if (el) el.innerHTML = _hubrJson(data, 'ok');
    toast(`✅ Warehouse ${hub} configurado!`, 'ok');
  } catch (e) {
    if (el) el.innerHTML = _hubrJson({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

// ══════════════════════════════════════════════════════════════
//  COLETA — Pick & Cancel Delivery
// ══════════════════════════════════════════════════════════════

async function hubrPickDelivery() {
  const extId = document.getElementById('hubr-so-pick-extid')?.value?.trim();
  const el = document.getElementById('hubr-so-pick-result');
  if (!extId) { toast('Informe o External Delivery ID.', 'err'); return; }

  // Shopper name — usa o campo ou gera aleatório
  let shopperName = document.getElementById('hubr-so-pick-shopper')?.value?.trim();
  if (!shopperName) {
    const names = ['Ana','Bruno','Carlos','Daniela','Eduardo','Fernanda','Gabriel','Helena'];
    const lasts = ['Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira'];
    shopperName = names[Math.floor(Math.random()*names.length)] + ' ' + lasts[Math.floor(Math.random()*lasts.length)];
  }

  if (el) el.innerHTML = '<span class="spinner-sm"></span> <span style="font-size:11px">Realizando pick…</span>';

  try {
    const res = await fetch('/api/rops/deliveries/pick', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery: { external_delivery_id: extId, shopper_name: shopperName } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data.error || data));

    const status = data.delivery?.status || 'picking';
    if (el) el.innerHTML = `<div class="rsv-result-ok">
      <strong>Pick realizado!</strong>
      <div class="rsv-tags">
        <span class="rsv-tag">Status: ${status}</span>
        <span class="rsv-tag">Shopper: ${shopperName}</span>
      </div>
    </div>`;
    toast('✅ Pick realizado! Status: ' + status, 'ok');
  } catch (e) {
    if (el) el.innerHTML = _hubrJson({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}

async function hubrCancelDelivery() {
  const extId = document.getElementById('hubr-so-pick-extid')?.value?.trim();
  const el = document.getElementById('hubr-so-pick-result');
  if (!extId) { toast('Informe o External Delivery ID.', 'err'); return; }

  if (el) el.innerHTML = '<span class="spinner-sm"></span> <span style="font-size:11px">Cancelando…</span>';

  try {
    const res = await fetch('/api/rops/deliveries/cancel', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery: { external_delivery_id: extId } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data.error || data));

    const status = data.delivery?.status || 'cancelled';
    if (el) el.innerHTML = `<div style="background:var(--red-dim);border:1px solid var(--red);border-radius:6px;padding:10px;font-size:12px;color:var(--red)">
      <strong>Delivery cancelada</strong> — Status: ${status}
    </div>`;
    toast('Delivery cancelada', 'ok');
  } catch (e) {
    if (el) el.innerHTML = _hubrJson({ error: e.message }, 'err');
    toast('Erro: ' + e.message, 'err');
  }
}
