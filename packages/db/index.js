// ============================================================
//  packages/db/index.js — IndexedDB browser wrapper
//
//  v2 — mudanças em relação à v1:
//  - vendors: campo sf_account_id (ID real do Salesforce)
//  - products: keyPath = 'sfId' (único por SF); índice 'uom'
//  - migration automática de v1 → v2
// ============================================================

const DB_NAME    = 'management_test_db';
const DB_VERSION = 2;          // bumped de 1 para 2
let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db      = e.target.result;
      const oldVer  = e.oldVersion; // 0 = banco novo, 1 = migração

      // ── HUBS (inalterado) ──────────────────────────────
      if (!db.objectStoreNames.contains('hubs')) {
        const hs = db.createObjectStore('hubs', { keyPath: 'id' });
        hs.createIndex('name', 'name', { unique: true });
      }

      // ── VENDORS ───────────────────────────────────────
      // v2: adiciona campo sf_account_id
      if (!db.objectStoreNames.contains('vendors')) {
        const vs = db.createObjectStore('vendors', { keyPath: 'id' });
        vs.createIndex('name',           'name',           { unique: false });
        vs.createIndex('cnpj',           'cnpj',           { unique: false });
        vs.createIndex('sf_account_id',  'sf_account_id',  { unique: false });
      }

      // ── HUB <-> VENDOR N:N (inalterado) ───────────────
      if (!db.objectStoreNames.contains('hub_vendor')) {
        const hv = db.createObjectStore('hub_vendor', { keyPath: 'id', autoIncrement: true });
        hv.createIndex('hub_id',    'hub_id',    { unique: false });
        hv.createIndex('vendor_id', 'vendor_id', { unique: false });
        hv.createIndex('pair', ['hub_id','vendor_id'], { unique: true });
      }

      // ── PRODUCTS ──────────────────────────────────────
      // v1: keyPath = 'cod' (problemático: código pode repetir entre vendors)
      // v2: keyPath = 'sfId' (ID único do Salesforce), índice por uom
      if (db.objectStoreNames.contains('products') && oldVer < 2) {
        // Migração: remove a store antiga e recria com nova chave
        db.deleteObjectStore('products');
      }
      if (!db.objectStoreNames.contains('products')) {
        const ps = db.createObjectStore('products', { keyPath: 'sfId' });
        ps.createIndex('vendor_id', 'vendor_id', { unique: false });
        ps.createIndex('uom',       'uom',       { unique: false });
        ps.createIndex('vendor_uom',['vendor_id','uom'], { unique: false });
        ps.createIndex('active',    'active',    { unique: false });
      }

      // ── PURCHASE ORDERS (inalterado) ──────────────────
      if (!db.objectStoreNames.contains('pos')) {
        const po = db.createObjectStore('pos', { keyPath: 'id', autoIncrement: true });
        po.createIndex('hub_id',     'hub_id',     { unique: false });
        po.createIndex('vendor_id',  'vendor_id',  { unique: false });
        po.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

// ── Generic helpers ───────────────────────────────────────
function tx(store, mode = 'readonly') {
  return _db.transaction(store, mode).objectStore(store);
}
function all(store) {
  return new Promise((res, rej) => {
    const r = tx(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}
function byIndex(store, idx, val) {
  return new Promise((res, rej) => {
    const r = tx(store).index(idx).getAll(val);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}
function put(store, obj) {
  return new Promise((res, rej) => {
    const r = tx(store, 'readwrite').put(obj);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}
function del(store, key) {
  return new Promise((res, rej) => {
    const r = tx(store, 'readwrite').delete(key);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}
function delByIndex(store, idx, val) {
  return new Promise((res, rej) => {
    const s    = tx(store, 'readwrite');
    const ireq = s.index(idx).getAllKeys(val);
    ireq.onsuccess = () => {
      const keys = ireq.result;
      if (!keys.length) return res();
      let done = 0;
      keys.forEach(k => {
        const dr = s.delete(k);
        dr.onsuccess = () => { if (++done === keys.length) res(); };
        dr.onerror   = () => rej(dr.error);
      });
    };
    ireq.onerror = () => rej(ireq.error);
  });
}

// ── DB API ────────────────────────────────────────────────
const DB = {

  // ── HUBS ──────────────────────────────────────────────
  async getHubs()    { return all('hubs'); },
  async saveHub(hub) { return put('hubs', hub); },
  async deleteHub(id) {
    await del('hubs', id);
    await delByIndex('hub_vendor', 'hub_id', id);
  },

  // ── VENDORS ───────────────────────────────────────────
  async getVendors()       { return all('vendors'); },
  async saveVendor(v)      { return put('vendors', v); },
  async deleteVendor(id) {
    await del('vendors', id);
    await delByIndex('hub_vendor', 'vendor_id', id);
    // produtos do vendor permanecem — serão substituídos no próximo sync
  },

  // ── HUB <-> VENDOR ────────────────────────────────────
  async getVendorsByHub(hub_id) {
    const links   = await byIndex('hub_vendor', 'hub_id', hub_id);
    const vendors = await all('vendors');
    const ids     = new Set(links.map(l => l.vendor_id));
    return vendors.filter(v => ids.has(v.id));
  },
  async getHubsByVendor(vendor_id) {
    const links = await byIndex('hub_vendor', 'vendor_id', vendor_id);
    const hubs  = await all('hubs');
    const ids   = new Set(links.map(l => l.hub_id));
    return hubs.filter(h => ids.has(h.id));
  },
  async linkHubVendor(hub_id, vendor_id) {
    return put('hub_vendor', { hub_id, vendor_id });
  },
  async unlinkHubVendor(hub_id, vendor_id) {
    const links = await byIndex('hub_vendor', 'hub_id', hub_id);
    const match = links.find(l => l.vendor_id === vendor_id);
    if (match) await del('hub_vendor', match.id);
  },

  // ── PRODUCTS ──────────────────────────────────────────
  // keyPath = sfId (único por SF, sem colisões entre vendors)

  async getProductsByVendor(vendor_id) {
    return byIndex('products', 'vendor_id', vendor_id);
  },
  async getProductsByVendorUom(vendor_id, uom) {
    return byIndex('products', 'vendor_uom', [vendor_id, uom]);
  },
  async getActiveProductsByVendor(vendor_id) {
    const prods = await byIndex('products', 'vendor_id', vendor_id);
    return prods.filter(p => p.active !== false);
  },
  async saveProduct(p)  { return put('products', p); },
  async deleteProduct(sfId) { return del('products', sfId); },

  /**
   * Substitui TODOS os produtos de um vendor+uom pelos novos.
   * Usado após sync com o Salesforce.
   * @param {string}  vendor_id
   * @param {string}  uom
   * @param {Array}   products  - array normalizado vindo da API
   */
  async syncProducts(vendor_id, uom, products) {
    // Remove os produtos antigos do vendor+uom
    const old = await byIndex('products', 'vendor_uom', [vendor_id, uom]);
    for (const p of old) await del('products', p.sfId);
    // Insere os novos
    for (const p of products) {
      await put('products', {
        ...p,
        vendor_id,
        uom,
        synced_at: new Date().toISOString(),
        active: true,
      });
    }
    return products.length;
  },

  // ── PURCHASE ORDERS ───────────────────────────────────
  async savePO(po) {
    return put('pos', { ...po, created_at: new Date().toISOString() });
  },
  async getPOs()               { return all('pos'); },
  async getPOsByHub(hub_id)    { return byIndex('pos', 'hub_id',    hub_id); },
  async getPOsByVendor(vid)    { return byIndex('pos', 'vendor_id', vid); },

  // ── SEED ──────────────────────────────────────────────
  async seed() {
    const hubs = await all('hubs');
    if (hubs.length > 0) return; // já tem dados

    const HUBS = [
      { id:'hub-001', name:'SAO903', city:'São Paulo', uf:'SP', active:true },
    ];

    const VENDORS = [
      { id:'ven-001', name:'BRF SP', cnpj:'01838723009850', sf_account_id:'0015e00000sxEMhAAM', active:true },
    ];
    const LINKS = [
      { hub_id:'hub-001', vendor_id:'ven-001' },
    ];

    for (const h of HUBS)     await put('hubs',    h);
    for (const v of VENDORS)  await put('vendors', v);
    for (const l of LINKS)    await put('hub_vendor', l);
    console.log('[DB] Seed concluído — produtos vazios, serão carregados do SF');
  },
};
