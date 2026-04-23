// ============================================================
//  reservaki.js — Reservaki: Turnos, Vagas, Divulgação
//  Cada step é independente. Slots e Divulgação buscam turnos
//  existentes via GET /api/reservaki/shifts.
// ============================================================

const RSV = { slotCsv:null, divCsv:null, log:[], apiShifts:[], selectedShifts:new Set(), selectedShiftsDiv:new Set() };

// ── Tab ──────────────────────────────────────────────────────
function setRopsTab(tab) {
  ['delivery','reservaki'].forEach(t=>{
    const el=document.getElementById('rops-tab-'+t);
    if(el) el.style.display=t===tab?'':'none';
  });
  document.querySelectorAll('#rops-tabs-bar .top-tab').forEach((btn,i)=>{
    btn.classList.toggle('active',['delivery','reservaki'][i]===tab);
  });
  if(tab==='reservaki') rsvInit();
}

function rsvInit(){
  // Auto-load shifts for both sections
  rsvLoadShifts();
  rsvLoadShiftsDiv();
}

function rsvSelectAll(context){
  const set=context==='slot'?RSV.selectedShifts:RSV.selectedShiftsDiv;
  RSV.apiShifts.forEach(s=>set.add(s.name));
  const containerId=context==='slot'?'rsv-shift-list':'rsv-div-shift-list';
  const el=document.getElementById(containerId);
  if(el) _rsvRenderShiftCheckboxes(el,context);
}

// ── Reset ────────────────────────────────────────────────────
function rsvReset() {
  RSV.slotCsv=null; RSV.divCsv=null; RSV.log=[]; RSV.apiShifts=[];
  RSV.selectedShifts=new Set(); RSV.selectedShiftsDiv=new Set();
  document.getElementById('rsv-shift-qty').value='3';
  document.getElementById('rsv-shift-start').value='07:00';
  document.getElementById('rsv-shift-duration').value='30';
  document.getElementById('rsv-email').value='automations@soudaki.com';
  document.getElementById('rsv-slot-hub').value='SAO022';
  document.getElementById('rsv-slot-days').value='2';
  document.getElementById('rsv-slot-qty').value='50';
  document.getElementById('rsv-div-hub').value='SAO022';
  document.getElementById('rsv-div-days').value='2';
  document.getElementById('rsv-div-qty').value='50';
  document.querySelectorAll('#rsv-medal-group input,#rsv-modal-group input').forEach(cb=>{cb.checked=true;cb.parentElement.classList.add('active');});
  ['rsv-shifts-result','rsv-slots-result','rsv-div-result','rsv-log-panel'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  ['btn-rsv-dl-slot','btn-rsv-dl-div'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  document.getElementById('rsv-shift-list').innerHTML='<span style="font-size:11px;color:var(--text3)">Clique em "Carregar da API"</span>';
  document.getElementById('rsv-div-shift-list').innerHTML='<span style="font-size:11px;color:var(--text3)">Clique em "Carregar da API"</span>';
  toast('Campos limpos!','info');
}

// ── Log ──────────────────────────────────────────────────────
function _rsvLog(msg,type='info'){
  const t=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const icon=type==='ok'?'✅':type==='err'?'❌':type==='warn'?'⚠️':'ℹ️';
  RSV.log.push({time:t,msg,type,icon});
  const p=document.getElementById('rsv-log-panel'),el=document.getElementById('rsv-log');
  if(p&&el){p.style.display='';
    el.innerHTML=RSV.log.slice().reverse().map(l=>`<div class="rsv-log-line rsv-log-${l.type}"><span class="rsv-log-time">${l.time}</span><span>${l.icon} ${esc(l.msg)}</span></div>`).join('');
  }
}

// ── CSV Download ─────────────────────────────────────────────
function rsvDownloadCSV(type){
  const csv=type==='slot'?RSV.slotCsv:RSV.divCsv;
  if(!csv){toast('Nenhum CSV gerado.','err');return;}
  download(type==='slot'?'slot.csv':'divulgationPlanning.csv',csv,'text/csv');
}

// ══════════════════════════════════════════════════════════════
//  STEP 1: CRIAR TURNOS
//  Lógica: usuário define horário de início e duração.
//  Turno 1: start → start+duração.
//  Turno 2: fim do anterior + 1min → +duração.
//  E assim por diante.
// ══════════════════════════════════════════════════════════════
async function rsvCreateShifts(){
  const qty=parseInt(document.getElementById('rsv-shift-qty')?.value)||3;
  const baseName=document.getElementById('rsv-shift-name')?.value?.trim()||'Turno';
  const startTime=document.getElementById('rsv-shift-start')?.value||'07:00';
  const duration=parseInt(document.getElementById('rsv-shift-duration')?.value)||30;
  const email=document.getElementById('rsv-email')?.value||'automations@soudaki.com';

  const btn=document.getElementById('btn-rsv-shifts');
  if(btn){btn.disabled=true;btn.textContent='⏳ Criando…';}

  _rsvLog(`Criando ${qty} turno(s) "${baseName}" a partir de ${startTime}, duração ${duration}min`);

  try{
    const shifts=[];
    let startMin=_m(startTime);

    for(let i=0;i<qty;i++){
      const endMin=startMin+duration;
      const name=qty===1?baseName:`${baseName}_${i}`;
      const start=_h(startMin)+':00';
      const end=_h(endMin)+':00';
      shifts.push({name,start,end});
      startMin=endMin+1; // próximo começa 1min depois
    }

    let created=0;
    for(const s of shifts){
      try{
        const res=await fetch('/api/reservaki/shifts',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({name:s.name,start_time:s.start,end_time:s.end,created_by_email:email})});
        if(res.ok) created++;
        else _rsvLog(`Turno ${s.name}: erro ${res.status}`,'warn');
      }catch(e){_rsvLog(`Erro ${s.name}: ${e.message}`,'warn');}
    }

    _rsvLog(`${created}/${shifts.length} turnos criados`,'ok');
    const el=document.getElementById('rsv-shifts-result');
    if(el){el.style.display='';
      el.innerHTML=`<div class="rsv-result-ok"><strong>${created} turnos criados</strong><div class="rsv-tags">${shifts.map(s=>`<span class="rsv-tag">${s.name} ${s.start.slice(0,5)}–${s.end.slice(0,5)}</span>`).join('')}</div></div>`;
    }
    toast(`✅ ${created} turnos criados!`,'ok');
  }catch(e){_rsvLog('Erro: '+e.message,'err');toast('Erro: '+e.message,'err');}
  finally{if(btn){btn.disabled=false;btn.textContent='📋 Criar Turnos';}}
}

function _m(h){const p=h.split(':').map(Number);return p[0]*60+p[1];}
function _h(m){return`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}

// ══════════════════════════════════════════════════════════════
//  LOAD SHIFTS FROM API (para Slots e Divulgação)
// ══════════════════════════════════════════════════════════════
async function rsvLoadShifts(){await _rsvFetchAndRender('rsv-shift-list','slot');}
async function rsvLoadShiftsDiv(){await _rsvFetchAndRender('rsv-div-shift-list','div');}

async function _rsvFetchAndRender(containerId,context){
  const el=document.getElementById(containerId);
  if(!el)return;
  el.innerHTML='<span class="spinner-sm"></span> <span style="font-size:11px;color:var(--text2)">Buscando turnos…</span>';

  try{
    const res=await fetch('/api/reservaki/shifts');
    const data=await res.json();
    const shifts=data.shifts||data||[];
    RSV.apiShifts=Array.isArray(shifts)?shifts:[];

    if(!RSV.apiShifts.length){
      el.innerHTML='<span style="font-size:11px;color:var(--amber)">Nenhum turno encontrado. Crie turnos no Step 1 primeiro.</span>';
      return;
    }

    const set=context==='slot'?RSV.selectedShifts:RSV.selectedShiftsDiv;
    // Shifts load desmarcados por padrão
    _rsvRenderShiftCheckboxes(el,context);
    toast(`${RSV.apiShifts.length} turnos carregados`,'ok');
  }catch(e){
    el.innerHTML=`<span style="font-size:11px;color:var(--red)">Erro: ${esc(e.message)}</span>`;
  }
}

function _rsvRenderShiftCheckboxes(el,context){
  const set=context==='slot'?RSV.selectedShifts:RSV.selectedShiftsDiv;
  el.innerHTML=RSV.apiShifts.map(s=>{
    const checked=set.has(s.name);
    const start=(s.start_time||'').slice(0,5);
    const end=(s.end_time||'').slice(0,5);
    return `<label class="uom-chip ${checked?'active':''}" style="margin-bottom:4px">
      <input type="checkbox" value="${esc(s.name)}" ${checked?'checked':''}
        onchange="_rsvToggleShift(this,'${context}')"/>
      ${esc(s.name)} <span style="font-size:10px;color:var(--text3)">${start}–${end}</span>
    </label>`;
  }).join(' ');
}

function _rsvToggleShift(cb,context){
  const set=context==='slot'?RSV.selectedShifts:RSV.selectedShiftsDiv;
  if(cb.checked){set.add(cb.value);cb.parentElement.classList.add('active');}
  else{set.delete(cb.value);cb.parentElement.classList.remove('active');}
}

// ══════════════════════════════════════════════════════════════
//  STEP 2: CRIAR VAGAS (SLOTS) — independente
// ══════════════════════════════════════════════════════════════
async function rsvCreateSlots(){
  const hub=document.getElementById('rsv-slot-hub')?.value?.trim();
  if(!hub){toast('Informe o Hub.','err');return;}
  const days=parseInt(document.getElementById('rsv-slot-days')?.value)||2;
  const qty=parseInt(document.getElementById('rsv-slot-qty')?.value)||50;
  const email=document.getElementById('rsv-email')?.value||'automations@soudaki.com';

  const shiftNames=[...RSV.selectedShifts];
  if(!shiftNames.length){toast('Selecione pelo menos um turno. Clique em "Carregar da API".','err');return;}

  const btn=document.getElementById('btn-rsv-slots');
  if(btn){btn.disabled=true;btn.textContent='⏳ Gerando…';}

  _rsvLog(`Slots: hub=${hub}, ${days} dias, ${qty} vagas/turno, turnos: ${shiftNames.join(', ')}`);

  try{
    // Build CSV
    const header=`"Planilha de Criação de Vagas\nPreencha esta planilha indicando quando e em quais Hubs as vagas serão criadas, \nespecificando o nome dos turnos e a quantidade de vagas que serão disponibilizadas para as pessoas Riders.\n\nImportante! As pessoas Riders só receberão a oferta das vagas quando forem divulgadas posteriormente de forma manual, ok.",,,\n"Data das vagas\nEx: 12/02/2024","ID do Hub\nEx: SAO001","Nome do turno\nEx: M1, M2, T1, T2","Quantidade de vagas\nEx: 2, 5, 10"`;

    const hoje=new Date();
    const linhas=[];
    for(let d=0;d<days;d++){
      const dt=new Date(hoje);dt.setDate(dt.getDate()+d);
      const fmt=`${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
      for(const t of shiftNames){
        linhas.push(`"${fmt}","${hub}","${t}","${qty}"`);
      }
    }

    const csv=`${header}\n${linhas.join('\n')}`;
    RSV.slotCsv=csv;
    const totalVagas=days*shiftNames.length*qty;

    // Send
    const csvBase64=btoa(unescape(encodeURIComponent(csv)));
    const fileSize=new Blob([csv]).size;
    await fetch('/api/reservaki/slots',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({csvBase64,fileSize,createdBy:email})});

    _rsvLog(`Vagas enviadas: ${totalVagas} vagas (${hub}, ${days}d, ${shiftNames.length} turnos)`,'ok');
    const el=document.getElementById('rsv-slots-result');
    if(el){el.style.display='';
      el.innerHTML=`<div class="rsv-result-ok"><strong>Vagas enviadas</strong><div class="rsv-tags"><span class="rsv-tag">${totalVagas} vagas</span><span class="rsv-tag">${hub}</span><span class="rsv-tag">${days} dias</span>${shiftNames.map(t=>`<span class="rsv-tag">${t}</span>`).join('')}</div></div>`;
    }
    const dlBtn=document.getElementById('btn-rsv-dl-slot');if(dlBtn)dlBtn.style.display='';
    toast(`✅ ${totalVagas} vagas enviadas!`,'ok');
  }catch(e){_rsvLog('Erro: '+e.message,'err');toast('Erro: '+e.message,'err');}
  finally{if(btn){btn.disabled=false;btn.textContent='📦 Gerar e Enviar Vagas';}}
}

// ══════════════════════════════════════════════════════════════
//  STEP 3: DIVULGAÇÃO — independente
// ══════════════════════════════════════════════════════════════
async function rsvCreateDivulgation(){
  const hub=document.getElementById('rsv-div-hub')?.value?.trim();
  if(!hub){toast('Informe o Hub.','err');return;}
  const days=parseInt(document.getElementById('rsv-div-days')?.value)||2;
  const qty=parseInt(document.getElementById('rsv-div-qty')?.value)||50;
  const email=document.getElementById('rsv-email')?.value||'automations@soudaki.com';

  const shiftNames=[...RSV.selectedShiftsDiv];
  if(!shiftNames.length){toast('Selecione turnos. Clique em "Carregar da API".','err');return;}

  const medals=[...document.querySelectorAll('#rsv-medal-group input:checked')].map(cb=>cb.value);
  if(!medals.length){toast('Selecione pelo menos uma medalha.','err');return;}

  const modals=[...document.querySelectorAll('#rsv-modal-group input:checked')].map(cb=>cb.value);
  const modalStr=modals.length?modals.join(', '):'Moto';

  const medalStr=medals.join(', ');

  const btn=document.getElementById('btn-rsv-div');
  if(btn){btn.disabled=true;btn.textContent='⏳ Gerando…';}

  _rsvLog(`Divulgação: hub=${hub}, ${days}d, medalhas=[${medalStr}], modal=${modalStr}`);

  try{
    // Build CSV
    const header=`"Planilha de Divulgação de Vagas\nPreencha esta planilha com as regras de divulgação para as vagas já criadas no sistema, indicando a data, loja, turno, quantidade de vagas, modal e medalha. \nA data, loja e turno devem ser os mesmos informados na planilha de criação de vagas.\n\nImportante! Somente vagas criadas e não preenchidas serão divulgadas. A planilha serve apenas para definir as regras de divulgação.",,,,,\n"Data dos Slots\nEx: 12/02/2024","ID do Hub\nEx: SAO001","Turno\nEx: M1, T2, N3","Quantidade de Vagas\nEx: 2, 5, 10","Modal\nEx: Moto, Bike","Medalha\nEx: Diamante, Ouro, Prata, Bronze, Novo"`;

    const hoje=new Date();
    const linhas=[];
    for(let d=0;d<days;d++){
      const dt=new Date(hoje);dt.setDate(dt.getDate()+d);
      const fmt=`${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
      for(const t of shiftNames){
        linhas.push(`${fmt},${hub},${t},${qty},"${modalStr}","${medalStr}"`);
      }
    }

    const csv=`${header}\n${linhas.join('\n')}`;
    RSV.divCsv=csv;
    const totalVagas=days*shiftNames.length*qty;

    // Send
    const csvBase64=btoa(unescape(encodeURIComponent(csv)));
    const fileSize=new Blob([csv]).size;
    await fetch('/api/reservaki/divulgation',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({csvBase64,fileSize,createdBy:email})});

    _rsvLog(`Divulgação enviada: ${totalVagas} vagas, ${medalStr}, ${modalStr}`,'ok');
    const el=document.getElementById('rsv-div-result');
    if(el){el.style.display='';
      el.innerHTML=`<div class="rsv-result-ok"><strong>Divulgação enviada</strong><div class="rsv-tags"><span class="rsv-tag">${totalVagas} vagas</span><span class="rsv-tag">${hub}</span>${medals.map(m=>`<span class="rsv-tag">${m}</span>`).join('')}<span class="rsv-tag">${modalStr}</span></div></div>`;
    }
    const dlBtn=document.getElementById('btn-rsv-dl-div');if(dlBtn)dlBtn.style.display='';
    toast(`✅ Divulgação concluída!`,'ok');
  }catch(e){_rsvLog('Erro: '+e.message,'err');toast('Erro: '+e.message,'err');}
  finally{if(btn){btn.disabled=false;btn.textContent='📢 Gerar e Divulgar';}}
}
