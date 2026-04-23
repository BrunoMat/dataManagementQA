// ============================================================
//  rops-scenarios.js — Cenários de Teste (Presets + Custom)
//
//  Cada cenário é um "snapshot" dos campos de delivery.
//  Campos com valor null = aleatório. Campos com valor = fixo.
//  Campos ausentes = não preencher (vazio).
//  Dependências: rops.js, db.js, state.js, helpers.js
// ============================================================

// ── Built-in Presets ─────────────────────────────────────────

const ROPS_PRESETS = [
  {
    id: '_preset_simples',
    name: 'Entrega Simples',
    icon: '📦',
    color: '#22c55e',
    description: '1 produto, sem código, gorjeta 0, fluxo básico',
    preset: true,
    config: {
      hub_id: null,           // usa o que estiver preenchido
      customer_name: null,    // null = aleatório
      customer_phone: null,   // null = aleatório
      tip: '0',
      note: '',
      delivery_code: false,
      products: 'auto:1',     // auto:N = busca N produtos aleatórios do hub
      post_actions: [],
    },
  },
  {
    id: '_preset_com_codigo',
    name: 'Entrega com Código',
    icon: '🔐',
    color: '#3b82f6',
    description: '1 produto, código de entrega ativado, gorjeta aleatória',
    preset: true,
    config: {
      customer_name: null,
      customer_phone: null,
      tip: null,              // null = aleatório
      note: '',
      delivery_code: true,
      products: 'auto:1',
      post_actions: [],
    },
  },
  {
    id: '_preset_lifecycle',
    name: 'Lifecycle Completo',
    icon: '🔄',
    color: '#14b8a6',
    description: 'Cria → Pick automático. Testa fluxo completo.',
    preset: true,
    config: {
      customer_name: null,
      customer_phone: null,
      tip: null,
      note: 'Teste lifecycle completo — auto pick',
      delivery_code: false,
      products: 'auto:2',
      post_actions: ['pick'],
    },
  },
  {
    id: '_preset_multi3',
    name: 'Multi-Delivery',
    icon: '⚡',
    color: '#ec4899',
    description: 'Cria múltiplas deliveries sequenciais (padrão 3x, ajustável)',
    preset: true,
    config: {
      customer_name: null,
      customer_phone: null,
      tip: null,
      note: '',
      delivery_code: false,
      products: 'auto:2',
      post_actions: [],
      repeat: 3,
    },
  },
];

// ── Estado ───────────────────────────────────────────────────
let _scenariosCustom = [];
let _scenariosExpanded = true;

// ── Init ─────────────────────────────────────────────────────
async function scenariosInit() {
  _scenariosCustom = await DB.getRopsScenarios();
  scenariosRender();
}

// ── Render ───────────────────────────────────────────────────
function scenariosRender() {
  const container = document.getElementById('rops-scenarios');
  if (!container) return;

  const allScenarios = [...ROPS_PRESETS, ..._scenariosCustom];

  container.innerHTML = `
    <div class="scenarios-header" onclick="_scenariosExpanded=!_scenariosExpanded;scenariosRender()">
      <div class="scenarios-title">
        <span class="scenarios-toggle">${_scenariosExpanded ? '▼' : '▶'}</span>
        ⚡ Cenários Rápidos
        <span class="scenarios-count">${allScenarios.length}</span>
      </div>
      <div class="scenarios-actions" onclick="event.stopPropagation()">
        <button class="btn-ghost" style="font-size:11px;padding:4px 10px" onclick="scenarioSaveCurrentAsNew()">💾 Salvar cenário atual</button>
      </div>
    </div>
    ${_scenariosExpanded ? `<div class="scenarios-grid">
      ${allScenarios.map(s => _renderScenarioCard(s)).join('')}
    </div>` : ''}
  `;
}

function _renderScenarioCard(s) {
  const isPreset = s.preset;
  const borderColor = s.color || 'var(--border)';

  return `
    <div class="scenario-card" style="--sc-color:${borderColor}">
      <div class="scenario-card-top">
        <span class="scenario-icon">${s.icon || '📋'}</span>
        <div class="scenario-info">
          <div class="scenario-name">${esc(s.name)}</div>
          <div class="scenario-desc">${esc(s.description || '')}</div>
        </div>
      </div>
      <div class="scenario-btns">
        <button class="scenario-btn scenario-btn--load" onclick="scenarioLoad('${s.id}')">📥 Carregar</button>
        <button class="scenario-btn scenario-btn--exec" onclick="scenarioExecute('${s.id}')">▶ Executar</button>
        ${!isPreset ? `<button class="scenario-btn scenario-btn--del" onclick="scenarioDelete('${s.id}')">🗑</button>` : ''}
      </div>
      ${s.config?.repeat > 1 ? `<div class="scenario-tag-row">
        <span class="scenario-tag">×<input type="number" min="1" max="50" value="${s.config.repeat}"
          class="scenario-repeat-input" id="sc-repeat-${s.id}"
          onclick="event.stopPropagation()" onchange="event.stopPropagation()"/> deliveries</span>
      </div>` : ''}
      ${s.config?.post_actions?.includes('pick') ? `<div class="scenario-tag">+ auto pick</div>` : ''}
    </div>
  `;
}

// ── Load scenario (preenche campos sem enviar) ───────────────
async function scenarioLoad(id) {
  const s = _findScenario(id);
  if (!s) return;

  const cfg = s.config;

  // Hub
  if (cfg.hub_id) {
    const el = document.getElementById('rops-hub-id');
    if (el) el.value = cfg.hub_id;
  }

  // Cliente
  const nameEl = document.getElementById('rops-customer-name');
  if (nameEl) {
    if (cfg.customer_name === null) nameEl.value = _ropsRandomName();
    else nameEl.value = cfg.customer_name;
  }

  const phoneEl = document.getElementById('rops-customer-phone');
  if (phoneEl) {
    if (cfg.customer_phone === null) phoneEl.value = _ropsRandomPhone();
    else phoneEl.value = cfg.customer_phone;
  }

  // Gorjeta
  const tipEl = document.getElementById('rops-tip');
  if (tipEl) {
    if (cfg.tip === null) tipEl.value = Math.floor(Math.random() * 15) + 1;
    else tipEl.value = cfg.tip;
  }

  // Nota
  const noteEl = document.getElementById('rops-note');
  if (noteEl && cfg.note !== undefined) noteEl.value = cfg.note;

  // Código de entrega
  const codeCb = document.getElementById('rops-delivery-code-toggle');
  if (codeCb) {
    codeCb.checked = !!cfg.delivery_code;
    ropsToggleDeliveryCode();
  }

  // Datas — sempre fresh
  ropsGenerateNewData();
  // Re-aplica nome/telefone/tip/note que acabamos de configurar (generateNewData sobrescreve)
  if (nameEl && cfg.customer_name !== undefined) {
    nameEl.value = cfg.customer_name === null ? _ropsRandomName() : cfg.customer_name;
  }
  if (phoneEl && cfg.customer_phone !== undefined) {
    phoneEl.value = cfg.customer_phone === null ? _ropsRandomPhone() : cfg.customer_phone;
  }
  if (tipEl && cfg.tip !== undefined) {
    tipEl.value = cfg.tip === null ? Math.floor(Math.random() * 15) + 1 : cfg.tip;
  }
  if (noteEl && cfg.note !== undefined) noteEl.value = cfg.note;

  // Produtos
  ROPS.lineItems = [];
  if (typeof cfg.products === 'string' && cfg.products.startsWith('auto:')) {
    const count = parseInt(cfg.products.split(':')[1]) || 1;
    await _autoLoadProducts(count);
  } else if (Array.isArray(cfg.products)) {
    // Produtos fixos do cenário
    ROPS.lineItems = cfg.products.map(p => ({
      sku: p.sku || '', name: p.name || '', description: p.description || p.name || '',
      amount: p.amount || 1, location: p.location || '', salesforce_id: p.salesforce_id || '',
      barcodes: p.barcodes || [], image_url: p.image_url || '', tags: p.tags || [],
    }));
  }
  ropsRenderLineItems();

  // Endereço — seleciona o primeiro disponível se não especificado
  if (cfg.address_id) {
    ropsSelectAddr(cfg.address_id);
  } else if (ROPS.addresses.length && !ROPS.selectedAddr) {
    ropsSelectAddr(ROPS.addresses[0].id);
  }

  toast(`📥 Cenário "${s.name}" carregado! Ajuste e clique em Criar Delivery.`, 'ok');
}

// ── Execute scenario (carrega + cria direto) ─────────────────
async function scenarioExecute(id) {
  const s = _findScenario(id);
  if (!s) return;

  await scenarioLoad(id);

  // Validações
  if (!ROPS.selectedAddr) {
    toast('Selecione um endereço antes de executar.', 'err');
    return;
  }
  if (!ROPS.lineItems.length) {
    toast('Nenhum produto carregado. Verifique o Hub ID e tente novamente.', 'err');
    return;
  }

  const repeatInput = document.getElementById(`sc-repeat-${id}`);
  const repeat = repeatInput ? (parseInt(repeatInput.value)||1) : (s.config?.repeat || 1);
  const postActions = s.config?.post_actions || [];

  if (repeat === 1) {
    // Execução simples
    await ropsCreateDelivery();

    // Post actions
    if (postActions.includes('pick') && ROPS.lastExternalId) {
      await _wait(2000);
      await ropsPickDelivery();
    }
  } else {
    // Multi-delivery
    toast(`⚡ Criando ${repeat} deliveries…`, 'info');
    for (let i = 0; i < repeat; i++) {
      // Gera novos dados aleatórios para cada
      const nameEl = document.getElementById('rops-customer-name');
      const phoneEl = document.getElementById('rops-customer-phone');
      if (nameEl) nameEl.value = _ropsRandomName();
      if (phoneEl) phoneEl.value = _ropsRandomPhone();

      await ropsCreateDelivery();

      if (postActions.includes('pick') && ROPS.lastExternalId) {
        await _wait(1500);
        await ropsPickDelivery();
      }

      if (i < repeat - 1) await _wait(2000);
    }
    toast(`✅ ${repeat} deliveries criadas!`, 'ok');
  }
}

// ── Auto-load products from Hub ──────────────────────────────
async function _autoLoadProducts(count) {
  const hubName = document.getElementById('rops-hub-id')?.value?.trim();
  if (!hubName) return;

  try {
    const res = await fetch(`/api/rops/hub-products?hubName=${encodeURIComponent(hubName)}`);
    const data = await res.json();
    if (!res.ok || !data.products?.length) {
      toast('Nenhum produto encontrado no hub para o cenário.', 'err');
      return;
    }

    // Seleciona N produtos aleatórios
    const shuffled = data.products.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    ROPS.lineItems = selected.map(p => ({
      sku: p.sku || '', name: p.name || '', description: p.description || p.name || '',
      amount: Math.floor(Math.random() * 5) + 1,
      location: p.location || '', salesforce_id: p.salesforce_id || '',
      barcodes: p.barcode ? [p.barcode] : [], image_url: p.image_url || '', tags: [],
    }));
  } catch (e) {
    console.error('[Scenarios] Auto-load error:', e);
    toast('Erro ao carregar produtos para cenário: ' + e.message, 'err');
  }
}

// ── Save current state as new custom scenario ────────────────
function scenarioSaveCurrentAsNew() {
  const modal = document.getElementById('modal-rops-scenario');
  if (!modal) return;

  document.getElementById('rops-sc-f-name').value = '';
  document.getElementById('rops-sc-f-desc').value = '';
  document.getElementById('rops-sc-f-icon').value = '📋';
  document.getElementById('rops-sc-f-color').value = '#3b82f6';
  document.getElementById('rops-sc-f-repeat').value = '1';

  // Reset radios to defaults
  _scSetRadio('sc-opt-name', 'random');
  _scSetRadio('sc-opt-phone', 'random');
  _scSetRadio('sc-opt-tip', 'random');
  _scSetRadio('sc-opt-note', 'fixed');
  _scSetRadio('sc-opt-products', 'current');

  const autoPick = document.getElementById('rops-sc-f-autopick');
  if (autoPick) autoPick.checked = false;

  document.getElementById('rops-sc-auto-count-wrap').style.display = 'none';
  document.getElementById('rops-sc-auto-count').value = '1';

  // Toggle show/hide auto count when radio changes
  document.querySelectorAll('input[name="sc-opt-products"]').forEach(r => {
    r.onchange = () => {
      document.getElementById('rops-sc-auto-count-wrap').style.display =
        document.querySelector('input[name="sc-opt-products"]:checked')?.value === 'auto' ? '' : 'none';
    };
  });

  delete modal.dataset.editing;
  document.getElementById('rops-sc-modal-title').textContent = 'Salvar Cenário';
  modal.style.display = 'flex';
}

function _scSetRadio(name, value) {
  const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (r) r.checked = true;
}
function _scGetRadio(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || 'random';
}

async function scenarioSaveModal() {
  const modal = document.getElementById('modal-rops-scenario');
  const name = document.getElementById('rops-sc-f-name').value.trim();
  if (!name) { toast('Dê um nome ao cenário.', 'err'); return; }

  const editing = modal.dataset.editing || null;
  const el = id => document.getElementById(id)?.value ?? '';

  // Resolve cada campo com base no radio selecionado
  const nameOpt  = _scGetRadio('sc-opt-name');
  const phoneOpt = _scGetRadio('sc-opt-phone');
  const tipOpt   = _scGetRadio('sc-opt-tip');
  const noteOpt  = _scGetRadio('sc-opt-note');
  const prodOpt  = _scGetRadio('sc-opt-products');

  const config = {
    hub_id:         el('rops-hub-id') || null,
    customer_name:  nameOpt === 'random' ? null : (nameOpt === 'empty' ? '' : el('rops-customer-name')),
    customer_phone: phoneOpt === 'random' ? null : (phoneOpt === 'empty' ? '' : el('rops-customer-phone')),
    tip:            tipOpt === 'random' ? null : (tipOpt === 'empty' ? '0' : el('rops-tip')),
    note:           noteOpt === 'empty' ? '' : el('rops-note'),
    delivery_code:  document.getElementById('rops-delivery-code-toggle')?.checked || false,
    address_id:     ROPS.selectedAddr || null,
    products:       prodOpt === 'auto'
      ? `auto:${document.getElementById('rops-sc-auto-count')?.value || '1'}`
      : (ROPS.lineItems.length > 0
          ? ROPS.lineItems.map(it => ({
              sku: it.sku, name: it.name, description: it.description,
              amount: it.amount, location: it.location,
              salesforce_id: it.salesforce_id, barcodes: it.barcodes,
            }))
          : 'auto:1'),
    post_actions: document.getElementById('rops-sc-f-autopick')?.checked ? ['pick'] : [],
    repeat: parseInt(document.getElementById('rops-sc-f-repeat')?.value) || 1,
  };

  const scenario = {
    id: editing || ('sc-' + Date.now()),
    name,
    description: document.getElementById('rops-sc-f-desc').value.trim(),
    icon: document.getElementById('rops-sc-f-icon').value.trim() || '📋',
    color: document.getElementById('rops-sc-f-color').value || '#3b82f6',
    preset: false,
    config,
    created_at: editing ? undefined : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await DB.saveRopsScenario(scenario);
  _scenariosCustom = await DB.getRopsScenarios();
  scenariosRender();
  modal.style.display = 'none';
  toast(`💾 Cenário "${name}" salvo!`, 'ok');
}

function scenarioCloseModal() {
  document.getElementById('modal-rops-scenario').style.display = 'none';
}

async function scenarioDelete(id) {
  const s = _scenariosCustom.find(x => x.id === id);
  if (!s) return;
  showConfirm('Excluir cenário', `Excluir "${s.name}"?`, async () => {
    await DB.deleteRopsScenario(id);
    _scenariosCustom = await DB.getRopsScenarios();
    scenariosRender();
    toast('Cenário excluído.', 'info');
  });
}

// ── Helpers ──────────────────────────────────────────────────

function _findScenario(id) {
  return ROPS_PRESETS.find(s => s.id === id) || _scenariosCustom.find(s => s.id === id);
}

function _wait(ms) { return new Promise(r => setTimeout(r, ms)); }
