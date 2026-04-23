// ============================================================
//  navigation.js — Home screen navigation & construction page
// ============================================================

const CONSTRUCTION_PHRASES = [
  "Os devs estão construindo isso enquanto tomam café... muito café ☕",
  "Nossos hamsters estão girando a roda o mais rápido possível 🐹",
  "Está quase pronto! (mentira, mal começamos) 😅",
  "O estagiário está aprendendo a programar com este módulo 👶",
  "Se você apertar os olhos bem forte, quase dá pra ver a tela pronta 👀",
  "Culpa do merge conflict que ninguém quer resolver 🔥",
  "Em construção — igual aquela obra do vizinho que nunca termina 🏗️",
  "Os pixels estão sendo artesanalmente colocados um por um 🎨",
  "Deploy previsto para: logo logo... ou não 🚀",
  "Essa tela está em modo zen: meditando antes de nascer 🧘",
  "Nosso designer saiu pra almoçar e ainda não voltou... era 2023 🍔",
  "Estamos esperando a aprovação do PR desde a era glacial 🧊",
  "Funcionalidade em desenvolvimento! (a gente jura) 🤞",
  "O backend funciona! O frontend... estamos trabalhando nisso 🫠",
  "Página loading... eternamente loading... ⏳",
  "Esse módulo está na sprint 47... de 46 planejadas 📋",
  "A IA tentou gerar essa tela sozinha mas travou rindo 🤖",
  "Código compilando... desde terça-feira passada 💻",
  "Enviamos o dev numa missão secreta. Ele voltará com essa feature 🕵️",
  "Em breve! (breve no calendário maia) 📅",
  "Daki a pouco fica pronto!  ⏰",
  "Vai levar um tempo, Daki a gente precisa construir a máquina do tempo primeiro ⏳",
  "Daki um tempo, mas a gente promete que vai ser épico! 🚀"
];

const MODULE_NAMES = {
  hubr:  'HUBR',
  rops:  'RAIO',
  trade: 'TRADE',
  wms:   'WMS',
  tests: 'Executar Teste',
  estoque: 'Gestão de Estoque',
};

const ALL_VIEWS = ['view-home','view-trade','view-rops','view-tests','view-construction'];

function _hideAll(){ALL_VIEWS.forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});}

function goHome() {
  _hideAll();
  document.getElementById('view-home').style.display = '';
  document.getElementById('header-title').textContent = 'Data Management QA Testing Daki';
  document.title = 'Data Management QA Testing Daki';
  currentView = 'home';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goModule(module) {
  _hideAll();
  const title = MODULE_NAMES[module] || module.toUpperCase();

  if (['trade','rops','tests'].includes(module)) {
    const viewId = 'view-' + module;
    document.getElementById(viewId).style.display = '';
    document.getElementById('header-title').textContent = title;
    document.title = `${title} — Management QA Daki`;
    currentView = module;

    // Init hooks
    if (module === 'rops') ropsInit();
    if (module === 'tests') testsInit();
    if (module === 'hubr') hubrInit();
    if (module === 'wms') wmsInit();
  } else {
    document.getElementById('view-construction').style.display = '';
    document.getElementById('header-title').textContent = title;
    document.title = `${title} — Management QA Daki`;

    const nameEl = document.getElementById('construction-module-name');
    if (nameEl) nameEl.textContent = title;

    const phraseEl = document.getElementById('construction-phrase');
    if (phraseEl) phraseEl.textContent = CONSTRUCTION_PHRASES[Math.floor(Math.random() * CONSTRUCTION_PHRASES.length)];

    const pct = Math.floor(Math.random() * 35) + 8;
    const fillEl = document.querySelector('.construction-fill');
    const pctEl  = document.querySelector('.construction-pct');
    if (fillEl) fillEl.style.width = pct + '%';
    if (pctEl)  pctEl.textContent  = pct + '%';
    currentView = 'construction';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Keyboard shortcut: Escape → go home
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentView !== 'home') {
    // Don't go home if a modal is open
    const confirmModal = document.getElementById('modal-confirm');
    const hubModal     = document.getElementById('modal-hub');
    const vendorModal  = document.getElementById('modal-vendor');
    const ropsAddrModal = document.getElementById('modal-rops-addr');
    if (confirmModal?.style.display !== 'none' && confirmModal?.style.display !== '') return;
    if (hubModal?.style.display !== 'none' && hubModal?.style.display !== '') return;
    if (vendorModal?.style.display !== 'none' && vendorModal?.style.display !== '') return;
    if (ropsAddrModal?.style.display !== 'none' && ropsAddrModal?.style.display !== '') return;
    goHome();
  }
});
