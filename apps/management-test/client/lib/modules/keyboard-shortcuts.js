// ============================================================
//  keyboard-shortcuts.js — Sistema de atalhos de teclado
// ============================================================

const SHORTCUTS = {
  // Navigation
  'ctrl+h': { action: () => goHome(), description: 'Voltar para Home' },
  'escape': { action: handleEscape, description: 'Voltar / Fechar modal' },
  
  // Modules (números rápidos)
  'ctrl+1': { action: () => goModule('trade'), description: 'Abrir TRADE' },
  'ctrl+2': { action: () => goModule('hubr'), description: 'Abrir HUBR' },
  'ctrl+3': { action: () => goModule('rops'), description: 'Abrir RAIO' },
  'ctrl+4': { action: () => goModule('wms'), description: 'Abrir WMS' },
  'ctrl+5': { action: () => goModule('tests'), description: 'Executar Teste' },
  
  // Actions
  'ctrl+s': { action: handleSave, description: 'Salvar/Gerar (contexto atual)' },
  'ctrl+n': { action: handleNew, description: 'Novo/Limpar (contexto atual)' },
  'ctrl+e': { action: handleExport, description: 'Exportar (contexto atual)' },
  'ctrl+k': { action: toggleShortcutsModal, description: 'Mostrar atalhos (este menu)' },
  
  // Utility
  'ctrl+l': { action: toggleTheme, description: 'Alternar tema claro/escuro' },
  'ctrl+r': { action: handleRefresh, description: 'Recarregar dados' },
  '?': { action: toggleShortcutsModal, description: 'Mostrar atalhos' },
};

// Previne comportamento padrão do browser para nossos atalhos
const PREVENT_DEFAULT_KEYS = ['ctrl+s', 'ctrl+n', 'ctrl+e', 'ctrl+k', 'ctrl+r'];

function normalizeKey(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey && e.key.length > 1) parts.push('shift');
  
  const key = e.key.toLowerCase();
  if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
    parts.push(key);
  }
  
  return parts.join('+');
}

function handleEscape() {
  // Prioridade: fechar modals abertos
  const modals = [
    'modal-confirm',
    'modal-hub', 
    'modal-vendor',
    'modal-rops-addr',
    'modal-shortcuts'
  ];
  
  for (const id of modals) {
    const modal = document.getElementById(id);
    if (modal && modal.style.display !== 'none' && modal.style.display !== '') {
      modal.style.display = 'none';
      return;
    }
  }
  
  // Se não há modal aberto, volta para home
  if (currentView !== 'home') {
    goHome();
  }
}

function handleSave() {
  // Contexto: salvar/gerar baseado na view atual
  if (currentView === 'trade') {
    const generateBtn = document.querySelector('[onclick*="generateNF"]');
    if (generateBtn && !generateBtn.disabled) generateBtn.click();
  } else if (currentView === 'rops') {
    const createBtn = document.querySelector('[onclick*="ropsCreateDelivery"]');
    if (createBtn && !createBtn.disabled) createBtn.click();
  } else if (currentView === 'tests') {
    const runBtn = document.querySelector('[onclick*="testsRunScenario"]');
    if (runBtn && !runBtn.disabled) runBtn.click();
  }
}

function handleNew() {
  // Contexto: novo/limpar baseado na view atual
  if (currentView === 'trade') {
    if (confirm('Limpar todos os dados e começar novo?')) {
      clearState();
      showToast('✨ Dados limpos! Começando do zero.', 'success');
    }
  } else if (currentView === 'rops') {
    // ROPS reset logic
    showToast('🔄 Formulário resetado', 'info');
  }
}

function handleExport() {
  // Contexto: exportar baseado na view atual
  if (currentView === 'trade') {
    const exportBtn = document.querySelector('[onclick*="exportXML"]');
    if (exportBtn) exportBtn.click();
  }
}

function handleRefresh() {
  // Recarregar dados do backend/salesforce
  if (currentView === 'trade') {
    loadProductsFromSF();
    showToast('🔄 Recarregando produtos do Salesforce...', 'info');
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  showToast(isDark ? '☀️ Tema claro ativado' : '🌙 Tema escuro ativado', 'info');
}

function toggleShortcutsModal() {
  let modal = document.getElementById('modal-shortcuts');
  
  if (!modal) {
    modal = createShortcutsModal();
    document.body.appendChild(modal);
  }
  
  modal.style.display = modal.style.display === 'none' ? '' : 'none';
}

function createShortcutsModal() {
  const modal = document.createElement('div');
  modal.id = 'modal-shortcuts';
  modal.className = 'modal';
  modal.style.display = 'none';
  
  const shortcuts = Object.entries(SHORTCUTS).map(([key, { description }]) => {
    const badge = key.split('+').map(k => 
      `<kbd class="kbd">${k === 'ctrl' ? '⌃' : k.toUpperCase()}</kbd>`
    ).join(' + ');
    
    return `
      <div class="shortcut-row">
        <div class="shortcut-keys">${badge}</div>
        <div class="shortcut-desc">${description}</div>
      </div>
    `;
  }).join('');
  
  modal.innerHTML = `
    <div class="modal-content modal-shortcuts-content">
      <div class="modal-header">
        <h3>⌨️ Atalhos de Teclado</h3>
        <button class="modal-close" onclick="toggleShortcutsModal()">✕</button>
      </div>
      <div class="modal-body shortcuts-grid">
        ${shortcuts}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="toggleShortcutsModal()">Fechar</button>
      </div>
    </div>
  `;
  
  return modal;
}

// Event listener principal
document.addEventListener('keydown', (e) => {
  // Ignora se está digitando em input/textarea
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    return;
  }
  
  const key = normalizeKey(e);
  const shortcut = SHORTCUTS[key];
  
  if (shortcut) {
    if (PREVENT_DEFAULT_KEYS.includes(key)) {
      e.preventDefault();
    }
    shortcut.action();
  }
});

// Visual feedback quando pressiona Ctrl
let ctrlHintTimeout;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Control' || e.key === 'Meta') {
    showCtrlHint();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'Control' || e.key === 'Meta') {
    hideCtrlHint();
  }
});

function showCtrlHint() {
  let hint = document.getElementById('ctrl-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'ctrl-hint';
    hint.className = 'ctrl-hint';
    hint.innerHTML = '⌨️ Pressione <kbd>K</kbd> para ver atalhos';
    document.body.appendChild(hint);
  }
  
  clearTimeout(ctrlHintTimeout);
  hint.style.display = '';
  hint.classList.add('show');
  
  ctrlHintTimeout = setTimeout(() => {
    hint.classList.remove('show');
  }, 2000);
}

function hideCtrlHint() {
  const hint = document.getElementById('ctrl-hint');
  if (hint) {
    hint.classList.remove('show');
  }
}

// Inicialização: carregar tema salvo
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}

console.log('⌨️ Keyboard shortcuts loaded! Press Ctrl+K or ? to see all shortcuts.');
