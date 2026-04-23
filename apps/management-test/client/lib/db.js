// ============================================================
//  db.js — Modern API Wrapper (Replacing IndexedDB)
//  Now calls the backend which uses MongoDB + Salesforce Cache
// ============================================================

/**
 * Interface DB para compatibilidade com o frontend existente.
 * Agora todas as chamadas são redirecionadas para a API do Backend.
 */
const DB = {
  // HUBS
  async getHubs() {
    return apiFetch('/api/hubs');
  },
  async saveHub(hub) {
    return apiFetch('/api/hubs', { method: 'POST', body: hub });
  },
  async deleteHub(id) {
    return apiFetch(`/api/hubs/${id}`, { method: 'DELETE' });
  },

  // VENDORS
  async getVendors() {
    return apiFetch('/api/vendors');
  },
  async saveVendor(v) {
    return apiFetch('/api/vendors', { method: 'POST', body: v });
  },
  async deleteVendor(id) {
    return apiFetch(`/api/vendors/${id}`, { method: 'DELETE' });
  },

  // HUB <-> VENDOR links (Implementar no backend se necessário, por enquanto via query)
  async getVendorsByHub(hub_id) {
    const hubs = await this.getHubs();
    const hub = hubs.find(h => h.id === hub_id);
    const hubName = hub ? hub.name : hub_id;
    
    const res = await apiFetch(`/api/vendors/by-hub?hubId=${hub_id}&hubName=${hubName}`);
    return res.vendors.map(v => ({
      id: v.id || v.accountId, // Prioriza o ID local se disponível
      name: v.accountName,
      active: true,
      sf_account_id: v.accountId
    }));
  },

  async linkHubVendor(hub_id, vendor_id, sf_account_id) {
    return apiFetch('/api/vendors/link-hub', { 
      method: 'POST', 
      body: { hubId: hub_id, vendorId: vendor_id, sfAccountId: sf_account_id } 
    });
  },
  async unlinkHubVendor(hub_id, vendor_id) {
    return apiFetch('/api/vendors/unlink-hub', { 
      method: 'POST', 
      body: { hubId: hub_id, vendorId: vendor_id } 
    });
  },

  // PRODUCTS
  async getActiveProductsByVendor(vendor_id, uom) {
    // vendor_id aqui é o sfAccountId ou o ID local
    let url = `/api/vendors/products?sfAccountId=${vendor_id}`;
    if (uom) url += `&uom=${uom}`;
    
    const res = await apiFetch(url);
    return res.products;
  },

  async getProductsByVendor(vendor_id) {
    return this.getActiveProductsByVendor(vendor_id);
  },

  /**
   * Sincroniza produtos (Força atualização do Salesforce para o MongoDB)
   */
  async syncProducts(vendor_id, uom, products_placeholder) {
    // No novo modelo, o backend faz o sync. O frontend apenas solicita.
    // O vendorName deve ser pego do estado ou passado
    const res = await apiFetch('/api/vendors/sync', {
      method: 'POST',
      body: { 
        sfAccountId: vendor_id, 
        uoms: [uom] 
      }
    });
    return res.totalProducts;
  },

  // PURCHASE ORDERS
  async savePO(po) {
    return apiFetch('/api/po/create', { method: 'POST', body: po });
  },
  async getPOs() {
    return apiFetch('/api/po/list'); // Implementar este endpoint no backend
  },

  // ROPS ADDRESSES
  async getRopsAddresses() {
    return apiFetch('/api/rops/addresses');
  },
  async saveRopsAddress(addr) {
    return apiFetch('/api/rops/addresses', { method: 'POST', body: addr });
  },
  async deleteRopsAddress(id) {
    return apiFetch(`/api/rops/addresses/${id}`, { method: 'DELETE' });
  },

  // ROPS SCENARIOS
  async getRopsScenarios() {
    return apiFetch('/api/rops/scenarios');
  },
  async saveRopsScenario(s) {
    return apiFetch('/api/rops/scenarios', { method: 'POST', body: s });
  },
  async deleteRopsScenario(id) {
    return apiFetch(`/api/rops/scenarios/${id}`, { method: 'DELETE' });
  },

  // SEED / RESET
  async seed() {
    console.log('[API] Seed gerenciado pelo Backend/Docker');
  }
};

// Funções globais para compatibilidade com app.js
async function openDB() { console.log('[API] Conectado ao Backend'); }
async function resetDB() { 
  console.warn('[API] Reset de DB remoto via frontend não permitido por segurança'); 
}
