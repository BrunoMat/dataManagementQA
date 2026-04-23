// ============================================================
//  helpers.js — Funções utilitárias puras (sem side effects)
//
//  Responsabilidade: formatação, parsing, escape, download.
//  Nenhuma dependência de DOM ou STATE.
// ============================================================

const UOM_LIST = ['ea', 'Pallet', 'Primary Case', 'Secondary Case', 'Weight'];

const UOM_FIELDS = {
  'ea':             ['unitsPerPrimaryCase'],
  'Pallet':         ['unitsPerPrimaryCase', 'unitsPerSecondaryCase', 'unitsPerPallet'],
  'Primary Case':   ['unitsPerPrimaryCase'],
  'Secondary Case': ['unitsPerPrimaryCase', 'unitsPerSecondaryCase'],
  'Weight':         ['unitsPerPrimaryCase', 'unitsPerWeight'],
};

const UOM_LABELS = {
  unitsPerPrimaryCase:   'Un/Primary',
  unitsPerSecondaryCase: 'Un/Secondary',
  unitsPerPallet:        'Un/Pallet',
  unitsPerWeight:        'Un/Weight',
};

// ── Formatação ───────────────────────────────────────────────

/** Lê valor de um input por id */
const g = id => document.getElementById(id)?.value || '';

/** Escapa HTML para exibição segura */
const esc = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/** Formata número no padrão pt-BR com 2 casas decimais */
const fmtN = n => Number(n).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata CNPJ: 00.000.000/0000-00 */
function fmtCNPJ(c) {
  const d = String(c).replace(/\D/g, '').padEnd(14, '0');
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

/** Faz parse de string numérica (suporta vírgula como separador decimal) */
function parseNum(s) {
  if (!s) return 0;
  s = String(s).trim();
  if (/\d,\d/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(s.replace(',', '.')) || 0;
}

/** Formata data ISO (YYYY-MM-DD) para DD/MM/YYYY */
function fmtDate(v) {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return d ? `${d}/${m}/${y}` : v;
}

/** Formata chave de acesso NF-e em blocos de 4 dígitos */
function fmtChave(raw) {
  return raw.replace(/\D/g, '')
    .padEnd(44, '0')
    .substring(0, 44)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

/** Auto-redimensiona textarea */
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/** Escapa string para uso em XML */
function xmlEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Dispara download de arquivo no navegador */
function download(filename, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Wrapper genérico para fetch da API local com tratamento de erro básico */
async function apiFetch(endpoint, options = {}) {
  const method = options.method || 'GET';
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const body = options.body ? JSON.stringify(options.body) : null;

  try {
    const res = await fetch(endpoint, { ...options, method, headers, body });
    if (!res.ok) {
      if (res.status === 204) return null;
      let msg = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        msg = err.error || err.message || msg;
      } catch (jsonErr) { /* fallback to status msg */ }
      throw new Error(msg);
    }
    return res.status === 204 ? null : await res.json();
  } catch (e) {
    const errorMsg = e.message || String(e);
    console.error(`[API] Erro em ${method} ${endpoint}:`, errorMsg);
    throw new Error(errorMsg);
  }
}

/** Retorna o valor de referência QTD/UN conforme UOM do produto */
function getQtyPerUnit(p) {
// ... (rest of the file remains same)

  const uom = p.uom || 'ea';
  switch (uom) {
    case 'Pallet':         return p.unitsPerPallet        ?? '—';
    case 'Secondary Case': return p.unitsPerSecondaryCase ?? '—';
    case 'Primary Case':   return p.unitsPerPrimaryCase   ?? '—';
    case 'Weight':         return p.unitsPerWeight         ?? '—';
    case 'ea':
    default:               return p.unitsPerPrimaryCase    ?? '—';
  }
}
