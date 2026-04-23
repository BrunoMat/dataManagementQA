// ============================================================
//  app.js — Orquestrador da aplicação
//
//  Este arquivo apenas inicializa a aplicação e conecta os
//  módulos. Toda lógica de negócio está nos módulos em:
//    ./modules/helpers.js    — Funções utilitárias puras
//    ./modules/state.js      — Estado global, toast, auth
//    ./modules/tabs.js       — Navegação entre abas/steps
//    ./modules/hub.js        — CRUD de hubs
//    ./modules/vendor.js     — CRUD de vendors
//    ./modules/products.js   — Fetch/sync de produtos SF
//    ./modules/po-table.js   — Tabela de Purchase Order
//    ./modules/nf-key.js     — Chave de acesso NF-e
//    ./modules/nf-items.js   — Itens da Nota Fiscal
//    ./modules/danfe.js      — Preview DANFE + exportação
//
//  Ordem de carregamento dos scripts (no HTML):
//    1. db.js         — IndexedDB
//    2. helpers.js    — sem dependências
//    3. state.js      — usa helpers
//    4. nf-key.js     — usa helpers, state
//    5. nf-items.js   — usa state, helpers
//    6. danfe.js      — usa state, helpers
//    7. hub.js        — usa state, helpers, db
//    8. vendor.js     — usa state, helpers, db
//    9. products.js   — usa state, helpers, db
//   10. po-table.js   — usa state, helpers, nf-key, nf-items
//   11. tabs.js       — usa tudo acima
//   12. app.js        — orquestra tudo (este arquivo)
//   13. navigation.js — navegação home/modules
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Inicializa banco local
  await openDB();
  await DB.seed();

  // Preenche datas padrão
  const today = new Date().toISOString().split('T')[0];
  const de = document.getElementById('nfDataEmis');
  const ds = document.getElementById('nfDataSaida');
  if (de) de.value = today;
  if (ds) ds.value = today;

  // Renderiza estado inicial
  await renderHubList();
  await renderVendorsMgmt();
  await renderHubsMgmt();
  renderItems();
  renderApiStatus('idle');

  // Verifica autenticação SF em background
  authCheck(false);
});

// ── Reset DB ─────────────────────────────────────────────────

function confirmResetDB() {
  showConfirm(
    'Resetar banco local',
    'Isso vai apagar todos os dados locais (hubs, vendors, produtos em cache, POs) e recriar com o seed padrão. Produtos serão recarregados do SF na próxima busca.',
    async () => {
      try {
        await resetDB();
        items = [];
        STATE.hub      = null;
        STATE.vendor   = null;
        STATE.products = [];
        STATE.poState  = {};

        await renderHubList();
        await renderVendorsMgmt();
        await renderHubsMgmt();
        renderItems();
        toast('Banco resetado com sucesso! Selecione o HUB para começar.', 'ok');
      } catch (e) {
        toast('Erro ao resetar: ' + e.message, 'err');
      }
    }
  );
}
