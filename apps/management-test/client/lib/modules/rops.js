// ============================================================
//  rops.js — ROPS — Rider Operations (Deliveries)
// ============================================================

const ROPS = {
  addresses:[], lineItems:[], selectedAddr:null,
  lastResult:null, lastExternalId:null, currentStatus:null,
  pickerProducts:[], pickerSelected:new Set(),
  deliveryHistory: [],  // [{delivery, externalId, status, createdAt}]
};

// ── Random data generators ───────────────────────────────────
const _RF = ['Ana','Bruno','Carlos','Daniela','Eduardo','Fernanda','Gabriel','Helena','Igor','Julia','Lucas','Mariana','Nicolas','Olivia','Pedro','Rafaela','Santiago','Tatiana','Victor','Yasmin','Arthur','Beatriz','Diego','Elena','Felipe','Giovanna','Henrique','Isabella','João','Karina','Leonardo','Melissa','Nathan','Paloma','Rodrigo','Sofia','Thiago','Valentina','William','Zara'];
const _RL = ['Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira','Alves','Pereira','Lima','Costa','Ribeiro','Martins','Carvalho','Araújo','Melo','Barbosa','Cardoso','Nascimento','Moreira','Teixeira','Mendes','Correia','Nunes','Vieira','Monteiro','Campos','Rocha','Dias','Freitas','Lopes'];
const _pick = a => a[Math.floor(Math.random()*a.length)];
function _ropsRandomName() { return _pick(_RF)+' '+_pick(_RL); }
function _ropsRandomPhone() {
  const ddd = ['21','11','31','41','51','61','71','81','85','92'][Math.floor(Math.random()*10)];
  const n = String(Math.floor(Math.random()*900000000)+100000000);
  return `+55${ddd}9${n}`;
}
function ropsGenerateExternalId() {
  const r=()=>Math.random().toString(36);
  return 'test000-'+r().substring(2,6)+'-'+r().substring(2,10)+'-'+r().substring(2,6)+'-0000000'+r().substring(2,5);
}

// ── Init ─────────────────────────────────────────────────────
async function ropsInit() {
  ROPS.addresses = await DB.getRopsAddresses();
  ropsRenderAddresses(); ropsRenderLineItems();
  ropsGenerateNewData(); ropsUpdateStatusCard();
  scenariosInit();
}

function ropsGenerateNewData() {
  const now = new Date();
  const el = id => document.getElementById(id);
  if(el('rops-confirmed-at'))  el('rops-confirmed-at').value = now.toISOString().slice(0,16);
  if(el('rops-estimated-to'))  el('rops-estimated-to').value = now.toISOString().slice(0,16);
  const later = new Date(now.getTime()+120*60000).toISOString().slice(0,16);
  if(el('rops-eta-min')) el('rops-eta-min').value = later;
  if(el('rops-eta-max')) el('rops-eta-max').value = later;
  if(el('rops-tip')) el('rops-tip').value = Math.floor(Math.random()*15)+1;
  if(el('rops-customer-name'))  el('rops-customer-name').value = _ropsRandomName();
  if(el('rops-customer-phone')) el('rops-customer-phone').value = _ropsRandomPhone();
}

// ── "Novo Dados" button handler ──────────────────────────────
function ropsNewData() {
  ropsGenerateNewData();
  ROPS.lineItems = [];
  ROPS.selectedAddr = null;
  ROPS.lastResult = null;
  ROPS.lastExternalId = null;
  ROPS.currentStatus = null;
  ROPS.deliveryHistory = [];
  ropsRenderLineItems();
  ropsRenderAddresses();
  ropsUpdateStatusCard();
  const formatted = document.getElementById('rops-formatted-addr');
  if(formatted) formatted.value = '';
  // Reset delivery code
  const cb = document.getElementById('rops-delivery-code-toggle');
  if(cb) { cb.checked=false; ropsToggleDeliveryCode(); }
  toast('Novos dados gerados! Selecione endereço e produtos.','info');
}

// ══════════════════════════════════════════════════════════════
//  DELIVERY HISTORY (lista de todos os pedidos da sessão)
// ══════════════════════════════════════════════════════════════

const _SC = {
  pre_processed:{bg:'var(--amber-dim)',b:'var(--amber)',c:'var(--amber)',l:'PRE PROCESSED'},
  picking:{bg:'var(--accent-dim)',b:'var(--accent)',c:'var(--accent)',l:'PICKING'},
  picked:{bg:'var(--green-dim)',b:'var(--green)',c:'var(--green)',l:'PICKED'},
  dispatched:{bg:'var(--green-dim)',b:'var(--green)',c:'var(--green)',l:'DISPATCHED'},
  cancelled:{bg:'var(--red-dim)',b:'var(--red)',c:'var(--red)',l:'CANCELLED'},
  canceled:{bg:'var(--red-dim)',b:'var(--red)',c:'var(--red)',l:'CANCELLED'},
};

function ropsUpdateStatusCard() {
  const card = document.getElementById('rops-status-card');
  if(!card) return;
  if(!ROPS.deliveryHistory.length) { card.style.display='none'; return; }

  const rows = ROPS.deliveryHistory.slice().reverse().map((h,ri) => {
    const idx = ROPS.deliveryHistory.length - 1 - ri;
    const d = h.delivery||{};
    const st = h.status||d.status||'—';
    const sc = _SC[st]||{bg:'var(--bg4)',b:'var(--border2)',c:'var(--text2)',l:st.toUpperCase()};
    const raio = `https://raio.staging.soudaki.com/deliveries/details/?deliveryId=${d.id}`;
    const cust = d.customer?.name||'—';
    const items = (d.line_items||[]).length;
    const time = h.createdAt?new Date(h.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';

    return `<tr class="dh-row">
      <td class="dh-cell-time">${time}</td>
      <td><span class="dh-badge" style="background:${sc.bg};border-color:${sc.b};color:${sc.c}">${sc.l}</span></td>
      <td class="dh-cell-id">${d.id||'—'}</td>
      <td class="dh-cell-customer">${esc(cust)}</td>
      <td class="dh-cell-hub">${d.external_hub_id||'—'}</td>
      <td class="dh-cell-items">${items}</td>
      <td class="dh-cell-actions">
        <a href="${raio}" target="_blank" rel="noopener" class="dh-action-btn" title="Raio">🔗 Raio</a>
        ${st==='pre_processed' || st==='picking' ? `<button class="dh-action-btn dh-action-btn--pick" onclick="ropsPickByIndex(${idx})">📋 Pick</button>` : ''}
        ${st==='pre_processed' ? `<button class="dh-action-btn dh-action-btn--ready" onclick="ropsPickAndReadyByIndex(${idx})">📦 Pick & Ready</button>` : ''}
        ${st==='picking' ? `<button class="dh-action-btn dh-action-btn--ready" onclick="ropsReadyByIndex(${idx})">📦 Ready</button>` : ''}
        ${st!=='cancelled'&&st!=='canceled'&&st!=='dispatched'?`<button class="dh-action-btn dh-action-btn--danger" onclick="ropsCancelByIndex(${idx})">✕ Cancelar</button>`:''}
      </td>
    </tr>`;
  }).join('');

  card.innerHTML = `<div class="dh-panel">
    <div class="dh-header">
      <span class="dh-title">📋 Deliveries <span class="dh-count">${ROPS.deliveryHistory.length}</span></span>
      <button class="btn-ghost" style="font-size:10px;padding:3px 8px" onclick="ropsClearHistory()">Limpar</button>
    </div>
    <div class="dh-table-wrap">
      <table class="dh-table"><thead><tr>
        <th>Hora</th><th>Status</th><th>ID</th><th>Cliente</th><th>Hub</th><th>Itens</th><th></th>
      </tr></thead><tbody>${rows}</tbody></table>
    </div>
  </div>`;
  card.style.display='';
}

function ropsClearHistory() {
  ROPS.deliveryHistory=[]; ROPS.lastResult=null; ROPS.lastExternalId=null; ROPS.currentStatus=null;
  ropsUpdateStatusCard();
}

async function ropsPickByIndex(idx) {
  const h=ROPS.deliveryHistory[idx]; if(!h||!h.externalId) return;
  const name=_ropsRandomName();
  try {
    const res=await fetch('/api/rops/deliveries/pick',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({delivery:{external_delivery_id:h.externalId,shopper_name:name}})});
    const data=await res.json(); if(!res.ok) throw new Error(JSON.stringify(data.error||data));
    h.status=data.delivery?.status||'picking'; if(h.delivery) h.delivery.status=h.status;
    ropsUpdateStatusCard(); toast(`✅ Pick #${h.delivery?.id}: ${name}`,'ok');
  } catch(e) { toast('Erro pick: '+e.message,'err'); }
}

async function ropsCancelByIndex(idx) {
  const h=ROPS.deliveryHistory[idx]; if(!h||!h.externalId) return;
  showConfirm('Cancelar Delivery',`Cancelar delivery #${h.delivery?.id||'—'}?`,async()=>{
    try {
      const res=await fetch('/api/rops/deliveries/cancel',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({delivery:{external_delivery_id:h.externalId}})});
      const data=await res.json(); if(!res.ok) throw new Error(JSON.stringify(data.error||data));
      h.status=data.delivery?.status||'cancelled'; if(h.delivery) h.delivery.status=h.status;
      ropsUpdateStatusCard(); toast(`Delivery #${h.delivery?.id} cancelada`,'ok');
    } catch(e) { toast('Erro: '+e.message,'err'); }
  });
}

// ── READY & Pick+Ready ───────────────────────────────────────

async function ropsReadyByIndex(idx) {
  const h=ROPS.deliveryHistory[idx]; if(!h||!h.externalId) return;
  try {
    const res=await fetch('/api/rops/deliveries/ready',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({delivery:{external_delivery_id:h.externalId}})});
    const data=await res.json(); if(!res.ok) throw new Error(JSON.stringify(data.error||data));
    h.status=data.delivery?.status||'dispatched'; if(h.delivery) h.delivery.status=h.status;
    ropsUpdateStatusCard(); toast(`✅ Delivery #${h.delivery?.id} marcada como READY/DISPATCHED`,'ok');
  } catch(e) { toast('Erro Ready: '+e.message,'err'); }
}

async function ropsPickAndReadyByIndex(idx) {
  const h=ROPS.deliveryHistory[idx]; if(!h||!h.externalId) return;
  try {
    // 1. Pick
    const name=_ropsRandomName();
    const resP=await fetch('/api/rops/deliveries/pick',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({delivery:{external_delivery_id:h.externalId,shopper_name:name}})});
    if(!resP.ok) {
       const d=await resP.json(); throw new Error('Falha no Pick: '+(d.error||JSON.stringify(d)));
    }
    toast('✅ Pick realizado','info');
    
    // Pequeno delay para processamento no backend
    await new Promise(r => setTimeout(r, 800));

    // 2. Ready
    const resR=await fetch('/api/rops/deliveries/ready',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({delivery:{external_delivery_id:h.externalId}})});
    const dataR=await resR.json(); if(!resR.ok) throw new Error('Falha no Ready: '+(dataR.error||JSON.stringify(dataR)));
    
    h.status=dataR.delivery?.status||'dispatched'; if(h.delivery) h.delivery.status=h.status;
    ropsUpdateStatusCard(); toast(`✅ Delivery #${h.delivery?.id} Completa (Pick & Ready)`,'ok');
  } catch(e) { toast(e.message,'err'); console.error(e); }
}

// Keep legacy functions working for scenarios
async function ropsPickDelivery() {
  if(!ROPS.lastExternalId) return;
  const idx=ROPS.deliveryHistory.findIndex(h=>h.externalId===ROPS.lastExternalId);
  if(idx>=0) await ropsPickByIndex(idx);
}
function ropsCancelDelivery() {
  if(!ROPS.lastExternalId) return;
  const idx=ROPS.deliveryHistory.findIndex(h=>h.externalId===ROPS.lastExternalId);
  if(idx>=0) ropsCancelByIndex(idx);
}

// ══════════════════════════════════════════════════════════════
//  ENDEREÇOS CRUD
// ══════════════════════════════════════════════════════════════

function ropsRenderAddresses() {
  const list = document.getElementById('rops-addr-list');
  if(!list) return;
  if(!ROPS.addresses.length) {
    list.innerHTML = `<div class="po-empty" style="padding:20px"><div class="po-empty-icon">📍</div><div class="po-empty-title">Nenhum endereço salvo</div><div>Clique em "+ Novo Endereço"</div></div>`;
    return;
  }
  list.innerHTML = ROPS.addresses.map(a => `
    <div class="rops-addr-card ${ROPS.selectedAddr===a.id?'selected':''}" onclick="ropsSelectAddr('${a.id}')">
      <div class="rops-addr-top"><div class="rops-addr-name">${esc(a.label||a.street)}</div>
        <div class="rops-addr-actions"><button class="btn-ghost" style="padding:3px 8px;font-size:10px" onclick="event.stopPropagation();ropsEditAddr('${a.id}')">✏️</button><button class="btn-danger" style="padding:3px 8px;font-size:10px" onclick="event.stopPropagation();ropsDeleteAddr('${a.id}')">🗑</button></div></div>
      <div class="rops-addr-detail">${esc(a.street)}, ${esc(a.number)} ${a.complement?'— '+esc(a.complement):''}</div>
      <div class="rops-addr-detail">${esc(a.neighborhood)} · ${esc(a.city)}</div>
      <div class="rops-addr-detail" style="font-family:var(--font-mono);font-size:10px;color:var(--text3)">lat: ${a.lat} · lng: ${a.lng}</div>
    </div>`).join('');
}
function ropsSelectAddr(id) {
  ROPS.selectedAddr=id; ropsRenderAddresses();
  const addr=ROPS.addresses.find(a=>a.id===id);
  if(addr) { const el=document.getElementById('rops-formatted-addr'); if(el) el.value=addr.formatted||`${addr.street}, ${addr.number}`; }
}
function ropsOpenAddrModal(editing=null) {
  const modal=document.getElementById('modal-rops-addr'), title=document.getElementById('rops-addr-modal-title');
  if(!modal) return;
  const fields=['label','formatted','street','number','complement','neighborhood','city','lat','lng'];
  if(editing) { const a=ROPS.addresses.find(x=>x.id===editing); if(!a) return; title.textContent='Editar Endereço'; fields.forEach(f=>{const el=document.getElementById('rops-addr-f-'+f);if(el)el.value=a[f]||'';}); modal.dataset.editing=editing;
  } else { title.textContent='Novo Endereço'; fields.forEach(f=>{const el=document.getElementById('rops-addr-f-'+f);if(el)el.value='';}); delete modal.dataset.editing; }
  modal.style.display='flex';
}
function ropsCloseAddrModal() { document.getElementById('modal-rops-addr').style.display='none'; }
async function ropsSaveAddrModal() {
  const modal=document.getElementById('modal-rops-addr'), editing=modal.dataset.editing||null;
  const data={id:editing||('rops-addr-'+Date.now()),label:document.getElementById('rops-addr-f-label').value.trim(),formatted:document.getElementById('rops-addr-f-formatted').value.trim(),street:document.getElementById('rops-addr-f-street').value.trim(),number:document.getElementById('rops-addr-f-number').value.trim(),complement:document.getElementById('rops-addr-f-complement').value.trim(),neighborhood:document.getElementById('rops-addr-f-neighborhood').value.trim(),city:document.getElementById('rops-addr-f-city').value.trim(),lat:parseFloat(document.getElementById('rops-addr-f-lat').value)||0,lng:parseFloat(document.getElementById('rops-addr-f-lng').value)||0};
  if(!data.street||!data.city){toast('Preencha Rua e Cidade.','err');return;}
  if(!data.formatted) data.formatted=`${data.street}, ${data.number}`;
  await DB.saveRopsAddress(data); ROPS.addresses=await DB.getRopsAddresses();
  ropsRenderAddresses(); ropsCloseAddrModal(); toast(editing?'Endereço atualizado!':'Endereço cadastrado!','ok');
}
function ropsEditAddr(id){ropsOpenAddrModal(id);}
async function ropsDeleteAddr(id){showConfirm('Excluir endereço','Tem certeza?',async()=>{await DB.deleteRopsAddress(id);ROPS.addresses=await DB.getRopsAddresses();if(ROPS.selectedAddr===id)ROPS.selectedAddr=null;ropsRenderAddresses();toast('Endereço excluído.','info');});}

// ══════════════════════════════════════════════════════════════
//  PRODUCT PICKER (Hub)
// ══════════════════════════════════════════════════════════════

async function ropsOpenProductPicker() {
  const hubName=document.getElementById('rops-hub-id')?.value?.trim();
  if(!hubName){toast('Preencha o External Hub ID.','err');return;}
  const modal=document.getElementById('modal-rops-products');
  document.getElementById('rops-picker-hub').textContent=hubName;
  document.getElementById('rops-picker-body').innerHTML='<tr><td colspan="5" class="po-loading"><span class="spinner"></span> Carregando…</td></tr>';
  document.getElementById('rops-picker-search').value=''; ROPS.pickerProducts=[]; ROPS.pickerSelected=new Set();
  modal.style.display='flex';
  try{
    const res=await fetch(`/api/rops/hub-products?hubName=${encodeURIComponent(hubName)}`);
    const data=await res.json(); if(!res.ok)throw new Error(data.error||'Erro');
    ROPS.pickerProducts=data.products||[]; ropsRenderPicker();
    toast(`${ROPS.pickerProducts.length} produtos no hub ${hubName}`,'ok');
  }catch(e){document.getElementById('rops-picker-body').innerHTML=`<tr><td colspan="5" class="po-empty"><div class="po-empty-icon">❌</div><div class="po-empty-title">${esc(e.message)}</div></td></tr>`;toast('Erro: '+e.message,'err');}
}
function ropsFilterPicker(){ropsRenderPicker();}
function _ropsFilteredPickerList(){const q=(document.getElementById('rops-picker-search')?.value||'').toLowerCase().trim();if(!q)return ROPS.pickerProducts;return ROPS.pickerProducts.filter(p=>(p.name||'').toLowerCase().includes(q)||(p.sku||'').toLowerCase().includes(q)||(p.barcode||'').toLowerCase().includes(q));}
function ropsRenderPicker(){
  const tbody=document.getElementById('rops-picker-body'),filtered=_ropsFilteredPickerList();
  if(!filtered.length){tbody.innerHTML='<tr><td colspan="5" class="po-empty"><div class="po-empty-icon">🔍</div><div class="po-empty-title">Nenhum produto encontrado</div></td></tr>';_ropsUpdatePickerCount();return;}
  tbody.innerHTML=filtered.map((p,i)=>{const key=p.salesforce_id||p.sku||i;const chk=ROPS.pickerSelected.has(key);
    return `<tr class="${chk?'po-selected':''}"><td class="td-chk"><label class="chk-wrap"><input type="checkbox" ${chk?'checked':''} onchange="ropsPickerToggle('${esc(key)}',this.checked)"/><span class="chk-box"></span></label></td><td class="td-code">${esc(p.sku)}</td><td title="${esc(p.description||p.name)}">${esc(p.name)}</td><td class="td-code">${esc(p.barcode)}</td><td class="td-code">${esc(p.location)}</td></tr>`;
  }).join(''); _ropsUpdatePickerCount();
}
function ropsPickerToggle(key,checked){if(checked)ROPS.pickerSelected.add(key);else ROPS.pickerSelected.delete(key);ropsRenderPicker();}
function ropsPickerToggleAll(checked){_ropsFilteredPickerList().forEach((p,i)=>{const k=p.salesforce_id||p.sku||i;if(checked)ROPS.pickerSelected.add(k);else ROPS.pickerSelected.delete(k);});ropsRenderPicker();}
function _ropsUpdatePickerCount(){const el=document.getElementById('rops-picker-count');if(el)el.textContent=ROPS.pickerSelected.size+' selecionado'+(ROPS.pickerSelected.size!==1?'s':'');}
function ropsCloseProductPicker(){document.getElementById('modal-rops-products').style.display='none';}
function ropsConfirmProductPicker(){
  if(!ROPS.pickerSelected.size){toast('Selecione pelo menos um produto.','err');return;}
  let added=0;
  ROPS.pickerProducts.forEach((p,i)=>{const key=p.salesforce_id||p.sku||i;if(!ROPS.pickerSelected.has(key))return;if(ROPS.lineItems.some(it=>it.sku===p.sku&&p.sku))return;
    ROPS.lineItems.push({sku:p.sku||'',name:p.name||'',description:p.description||p.name||'',amount:1,location:p.location||'',salesforce_id:p.salesforce_id||'',barcodes:p.barcode?[p.barcode]:[],image_url:p.image_url||'',tags:[]}); added++;
  });
  ropsRenderLineItems(); ropsCloseProductPicker(); toast(`${added} produto(s) adicionado(s)!`,'ok');
}

// ══════════════════════════════════════════════════════════════
//  LINE ITEMS — com todas as informações do produto
// ══════════════════════════════════════════════════════════════

function ropsAddLineItem(){
  ROPS.lineItems.push({sku:'',name:'',description:'',amount:1,location:'',salesforce_id:'',barcodes:[],image_url:'',tags:[],_loading:false});
  ropsRenderLineItems();
  setTimeout(()=>{const rows=document.querySelectorAll('#rops-items-area tr');const last=rows[rows.length-1];if(last){const inp=last.querySelector('.rops-sku-input');if(inp)inp.focus();}},50);
}
function ropsRemoveLineItem(i){ROPS.lineItems.splice(i,1);ropsRenderLineItems();}

function ropsRenderLineItems(){
  const area=document.getElementById('rops-items-area');if(!area)return;
  const countEl=document.getElementById('rops-items-count');if(countEl)countEl.textContent=ROPS.lineItems.length;
  if(!ROPS.lineItems.length){area.innerHTML=`<tr><td colspan="9" class="po-empty" style="padding:20px"><div class="po-empty-icon">📦</div><div class="po-empty-title">Nenhum produto adicionado</div><div>Use "Buscar no Hub" ou "+ Manual"</div></td></tr>`;return;}
  area.innerHTML=ROPS.lineItems.map((it,i)=>{
    const found=it.name?' rops-item-found':'';
    return `<tr class="${found}">
      <td style="text-align:center;color:var(--text3);font-size:11px">${i+1}</td>
      <td><div style="position:relative"><input class="nf-inp-desc rops-sku-input" value="${esc(it.sku)}" placeholder="SKU + Enter" onkeydown="if(event.key==='Enter'){event.preventDefault();ropsLookupSku(${i},this.value)}" onchange="ROPS.lineItems[${i}].sku=this.value" style="width:120px;font-family:var(--font-mono);font-size:12px;padding-right:24px"/>${it._loading?'<span class="spinner-sm" style="position:absolute;right:5px;top:50%;margin-top:-6px"></span>':''}</div></td>
      <td><input class="nf-inp-desc" value="${esc(it.name)}" placeholder="Nome" onchange="ROPS.lineItems[${i}].name=this.value;ROPS.lineItems[${i}].description=this.value" style="min-width:180px"/></td>
      <td class="td-code" style="font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${esc(it.description||'')}">${esc(it.description||'—')}</td>
      <td><input class="nf-inp-desc" value="${esc(it.barcodes[0]||'')}" placeholder="—" onchange="ROPS.lineItems[${i}].barcodes=[this.value]" style="width:130px;font-family:var(--font-mono);font-size:11px"/></td>
      <td><input class="nf-inp-desc" value="${esc(it.location)}" placeholder="—" onchange="ROPS.lineItems[${i}].location=this.value" style="width:80px;font-family:var(--font-mono);font-size:11px"/></td>
      <td class="td-code" style="font-size:9px;max-width:80px;overflow:hidden;text-overflow:ellipsis" title="${esc(it.salesforce_id||'')}">${it.salesforce_id?esc(it.salesforce_id.slice(-8)):'—'}</td>
      <td><div class="qty-cell"><button class="qty-btn" onclick="ropsChangeQty(${i},-1)">−</button><input class="qty-input" type="number" min="1" value="${it.amount}" id="rops-qty-${i}" onchange="ropsSetQty(${i},this.value)"/><button class="qty-btn" onclick="ropsChangeQty(${i},+1)">+</button></div></td>
      <td style="text-align:center"><button class="rm-btn" onclick="ropsRemoveLineItem(${i})" title="Remover">×</button></td>
    </tr>`;
  }).join('');
}
function ropsSetQty(i,val){const n=parseInt(val,10);ROPS.lineItems[i].amount=n>0?n:1;}
function ropsChangeQty(i,delta){const next=Math.max(1,(ROPS.lineItems[i].amount||1)+delta);ROPS.lineItems[i].amount=next;const inp=document.getElementById('rops-qty-'+i);if(inp)inp.value=next;}

// ── SKU lookup ───────────────────────────────────────────────
async function ropsLookupSku(index,sku){
  sku=(sku||'').trim(); if(!sku){toast('Digite um SKU.','err');return;}
  const hubName=document.getElementById('rops-hub-id')?.value?.trim();
  if(!hubName){toast('Preencha o Hub ID.','err');return;}
  ROPS.lineItems[index]._loading=true; ROPS.lineItems[index].sku=sku; ropsRenderLineItems();
  try{
    const res=await fetch(`/api/rops/product-by-sku?hubName=${encodeURIComponent(hubName)}&sku=${encodeURIComponent(sku)}`);
    const data=await res.json();
    if(!res.ok||!data.found){toast(`SKU ${sku} não encontrado no hub ${hubName}`,'err');ROPS.lineItems[index]._loading=false;ropsRenderLineItems();return;}
    ROPS.lineItems[index]={...ROPS.lineItems[index],sku:data.sku||sku,name:data.name||'',description:data.description||data.name||'',salesforce_id:data.salesforce_id||'',barcodes:data.barcode?[data.barcode]:[],location:data.location||ROPS.lineItems[index].location||'',image_url:data.image_url||'',_loading:false};
    ropsRenderLineItems(); toast(`✅ ${data.name}`,'ok');
  }catch(e){toast('Erro: '+e.message,'err');ROPS.lineItems[index]._loading=false;ropsRenderLineItems();}
}

// ══════════════════════════════════════════════════════════════
//  DELIVERY CODE
// ══════════════════════════════════════════════════════════════
function ropsToggleDeliveryCode(){
  const cb=document.getElementById('rops-delivery-code-toggle'),field=document.getElementById('rops-delivery-code-wrap'),inp=document.getElementById('rops-delivery-code');
  if(cb.checked){field.style.display='';inp.value=String(Math.floor(Math.random()*10000)).padStart(4,'0');}else{field.style.display='none';inp.value='';}
}

// ══════════════════════════════════════════════════════════════
//  CRIAR DELIVERY
// ══════════════════════════════════════════════════════════════
function ropsRequestCreate(){
  const addr=ROPS.addresses.find(a=>a.id===ROPS.selectedAddr);
  if(!addr){toast('Selecione um endereço.','err');return;}
  if(!ROPS.lineItems.length){toast('Adicione produtos.','err');return;}
  const hubId=document.getElementById('rops-hub-id')?.value?.trim();
  if(!hubId){toast('Preencha o Hub ID.','err');return;}
  const summary=ROPS.lineItems.map(it=>`• ${it.name||it.sku||'—'} (x${it.amount})`).join('\n');
  showConfirm('Confirmar criação de Delivery',`Hub: ${hubId}\nEndereço: ${addr.label||addr.street}\n${ROPS.lineItems.length} produto(s):\n${summary}`,()=>ropsCreateDelivery());
}

async function ropsCreateDelivery(){
  const addr=ROPS.addresses.find(a=>a.id===ROPS.selectedAddr);
  const hubId=document.getElementById('rops-hub-id')?.value?.trim();
  const btn=document.getElementById('btn-rops-create');
  if(btn){btn.disabled=true;btn.textContent='⏳ Criando…';}
  const now=new Date();
  const gd=id=>{const v=document.getElementById(id)?.value;return v?new Date(v).toISOString():null;};
  const extId=ropsGenerateExternalId();

  const delivery={
    total_tip_received:document.getElementById('rops-tip')?.value||'0',
    external_hub_id:hubId,
    external_delivery_id:extId,
    confirmed_at:gd('rops-confirmed-at')||now.toISOString(),
    estimated_to:gd('rops-estimated-to')||now.toISOString(),
    eta_min:gd('rops-eta-min')||new Date(now.getTime()+120*60000).toISOString(),
    eta_max:gd('rops-eta-max')||new Date(now.getTime()+120*60000).toISOString(),
    address:{formatted:addr.formatted||`${addr.street}, ${addr.number}`,lat:addr.lat,lng:addr.lng,street:addr.street,number:addr.number,complement:addr.complement||'',neighborhood:addr.neighborhood||'',city:addr.city},
    customer:{external_customer_id:'',name:document.getElementById('rops-customer-name')?.value?.trim()||_ropsRandomName(),orders_count:10,phone:document.getElementById('rops-customer-phone')?.value?.trim()||_ropsRandomPhone()},
    line_items:ROPS.lineItems.map(it=>({sku:it.sku,name:it.name,description:it.description||it.name,amount:it.amount,location:it.location,salesforce_id:it.salesforce_id||'',barcodes:(it.barcodes||[]).filter(b=>b),image_url:it.image_url||'',tags:it.tags||[]})),
    config:{webhook:'https://api.staging.soudaki.com/webhook',delivery_code:document.getElementById('rops-delivery-code-toggle')?.checked?(document.getElementById('rops-delivery-code')?.value||null):null,dispatch:true,type:'instant',assortment_type:'core',note:document.getElementById('rops-note')?.value||'',tasks:{verify_document:false,receive_payment:false}},
  };

  try{
    const res=await fetch('/api/rops/deliveries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({delivery})});
    const data=await res.json(); if(!res.ok)throw new Error(JSON.stringify(data.error||data));
    ROPS.lastResult=data; ROPS.lastExternalId=extId; ROPS.currentStatus=data.delivery?.status||null;
    // Push to history
    ROPS.deliveryHistory.push({
      delivery: data.delivery,
      externalId: extId,
      status: data.delivery?.status||'pre_processed',
      createdAt: new Date().toISOString(),
    });
    ropsUpdateStatusCard();
    toast(`✅ Delivery criada! ID: ${data.delivery?.id||'—'}`,'ok');
    // Offer navigation back to HUBR if function exists
    if (typeof hubrReceiveDelivery === 'function') {
      ROPS._lastCreatedData = data;
    }
  }catch(e){
    toast('Erro: '+e.message,'err');
    ROPS.lastResult={error:e.message}; ropsUpdateStatusCard();
  }finally{if(btn){btn.disabled=false;btn.textContent='🚀 Criar Delivery';}}
}
