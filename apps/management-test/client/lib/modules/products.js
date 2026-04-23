// ============================================================
//  products.js — Produtos do Salesforce
//
//  Responsabilidade: buscar produtos do SF, sync, UOM,
//  fallback para IndexedDB.
//  Dependências: state.js, helpers.js, db.js
// ============================================================

// ── UOM Selection ────────────────────────────────────────────

function getSelectedUoms() {
  const cbs = document.querySelectorAll('#uom-group input[type=checkbox]');
  const sel = [...cbs].filter(c => c.checked).map(c => c.value);
  if (sel.length) return sel;

  // Se nenhum estiver marcado, retorna todos os UOMs suportados por padrão
  return ['ea', 'Pallet', 'Primary Case', 'Secondary Case', 'Weight'];
}

function onUomChange() {
  document.querySelectorAll('.uom-chip').forEach(chip => {
    chip.classList.toggle('active', chip.querySelector('input')?.checked);
  });
  if (STATE.vendor) fetchVendorProducts();
}

// ── Fetch Produtos do SF ─────────────────────────────────────

async function fetchVendorProducts() {
  if (!STATE.vendor) return;

  const uoms = getSelectedUoms();
  STATE.products = [];
  STATE.poState  = {};

  renderApiStatus('loading', `Buscando produtos...`);
  showProductsLoading();

  try {
    const v = STATE.vendor;
    // Busca produtos do backend (que já gerencia o cache MongoDB/Salesforce)
    const results = await Promise.all(uoms.map(uom => _fetchUomProducts(v, uom)));
    const allProds = results.flatMap(r => r.products || []);

    if (allProds.length === 0) {
      renderApiStatus('error', 'Nenhum produto encontrado');
      toast('Nenhum produto encontrado para este vendor/UOM.', 'err');
      return await poRender();
    }

    // Processa a lista unificada
    STATE.products = processProductList(allProds);

    document.getElementById('ctx-prod-count').textContent = STATE.products.length;
    renderApiStatus('ok', `${STATE.products.length} produtos carregados`);
    
  } catch (e) {
    console.error('[fetchVendorProducts] Erro:', e);
    renderApiStatus('error', 'Erro: ' + e.message);
    toast('Erro ao carregar produtos: ' + e.message, 'err');
  }

  await poRender();
}

/** Busca produtos de um único UOM (usado em paralelo) */
async function _fetchUomProducts(vendor, uom) {
  try {
    let compatibleIds = null;

    // Busca IDs compatíveis (interseção vendor × estoque do hub)
    if (STATE.hub?.name) {
      try {
        const params = vendor.sf_account_id
          ? `sfAccountId=${vendor.sf_account_id}&hubName=${encodeURIComponent(STATE.hub.name)}&uom=${encodeURIComponent(uom)}`
          : `vendorName=${encodeURIComponent(vendor.name)}&hubName=${encodeURIComponent(STATE.hub.name)}&uom=${encodeURIComponent(uom)}`;

        const res = await fetch(`/api/vendors/compatible?${params}`);
        if (res.ok) {
          const data = await res.json();
          const ids  = data.productIds || [];
          if (ids.length > 0) compatibleIds = new Set(ids);
          console.log(`[fetchVendorProducts] ${ids.length} itens compatíveis encontrados para ${uom}`);
        } else {
          const err = await res.json().catch(() => ({}));
          console.warn(`[fetchVendorProducts] Erro no filtro de interseção:`, err.error || res.status);
        }
      } catch (err) {
        console.warn(`[fetchVendorProducts] Falha na rede ao buscar interseção:`, err.message);
      }
    }

    // Busca produtos do vendor
    const params = new URLSearchParams({ uom, limit: '500' });
    if (vendor.sf_account_id) params.set('sfAccountId', vendor.sf_account_id);
    if (vendor.cnpj)          params.set('cnpj', vendor.cnpj);
    if (vendor.name)          params.set('cnpjName', vendor.name);

    const res = await fetch(`/api/vendors/products?${params}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn(`[fetchVendorProducts] SF retornou ${res.status}:`, errData.error || errData);
      return { uom, products: [] };
    }

    const data = await res.json();
    let prods = data?.products || [];

    // Limpeza básica: remove itens nulos/inválidos
    prods = prods.filter(p => p && (p.sfId || p.productId || p.id || p.cod));
    if (compatibleIds) {
      prods = prods.filter(p => {
        const pid = p.productId || p.product_id || p.id;
        return pid && compatibleIds.has(pid);
      });
      console.log(`[fetchVendorProducts] Filtrados ${prods.length} produtos compatíveis de ${data?.products?.length || 0} totais.`);
    } else if (STATE.hub?.name) {
      // Se estamos em um HUB mas não resolveu a interseção, 
      // mostramos VAZIO para evitar carregar lista incompatível
      console.warn(`[fetchVendorProducts] Filtro de interseção ativo mas sem resultados para ${uom}.`);
      return { uom, products: [] };
    }

    return { uom, products: prods };

  } catch (err) {
    console.error(`[fetchVendorProducts] Erro UOM ${uom}:`, err.message);
    return { uom, products: [] };
  }
}

/** Inicializa o poState para cada produto */
function _initPoState(products) {
  products.forEach(p => {
    const key = p.sfId || p.productId;
    STATE.poState[key] = { qty: 1, selected: false };
  });
}

/** Fallback: carrega do IndexedDB local */
async function _loadProductsFromDB() {
  const prods = await DB.getActiveProductsByVendor(STATE.vendor.id);
  STATE.products = prods;
  _initPoState(prods);
  document.getElementById('ctx-prod-count').textContent = prods.length + ' (local)';
  renderApiStatus('idle', `${prods.length} produtos (cache local)`);
}

// ── Botão refresh ────────────────────────────────────────────

async function refreshProducts() {
  if (!STATE.vendor) return;
  toast('Atualizando produtos do SF…', 'info');
  await fetchVendorProducts();
}

// ── Sync via endpoint dedicado ───────────────────────────────

async function syncVendorProducts() {
  if (!STATE.vendor) return;

  const v    = STATE.vendor;
  const uoms = getSelectedUoms();

  if (!v.sf_account_id && !v.cnpj) {
    toast('Vendor sem SF Account ID ou CNPJ — não é possível sincronizar.', 'err');
    return;
  }

  renderApiStatus('loading', 'Sincronizando com SF…');
  const btn = document.getElementById('btn-refresh');
  if (btn) { btn.disabled = true; btn.textContent = '↻ Sincronizando…'; }

  try {
    const res = await fetch('/api/vendors/sync', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sfAccountId: v.sf_account_id || '',
        vendorName:  v.name,
        cnpj:        v.cnpj,
        uoms,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no sync');

    // Agrega produtos de todos os UOMs sincronizados
    const allSyncedProds = (data.syncedUoms || []).flatMap(u => u.products || []);
    const processed = processProductList(allSyncedProds);

    renderApiStatus('ok', `${processed.length} produtos sincronizados`);
    toast(`Sync concluído: ${processed.length} produtos únicos`, 'ok');
    
    // Atualiza o estado local e renderiza imediatamente
    STATE.products = processed;
    document.getElementById('ctx-prod-count').textContent = STATE.products.length;
    await poRender();

  } catch (e) {
    renderApiStatus('error', 'Sync falhou: ' + e.message);
    toast('Erro no sync: ' + e.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↻ Atualizar produtos'; }
  }
}

function processProductList(allProds) {
  if (!allProds || !Array.isArray(allProds)) return [];
  
  const seen = new Set();
  const unique = allProds.filter(p => {
    if (!p) return false;
    // Chave de deduplicação: prioriza o ID do Produto Salesforce
    const key = p.productId || p.product_id || p.sfId || p.id || p.cod;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  _initPoState(unique);
  return unique;
}

function showProductsLoading() {
  const tbody = document.getElementById('po-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr><td colspan="11" class="po-loading">
        <span class="spinner"></span> Consultando Salesforce…
      </td></tr>`;
  }
}
