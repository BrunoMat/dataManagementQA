// ============================================================
//  nf-key.js — Geração da Chave de Acesso NF-e (client-side)
//
//  Responsabilidade: gerar chave de acesso com dígito
//  verificador módulo 11 (padrão SEFAZ), autopreenchimento
//  dos campos de NF, regeneração de dados.
//  Dependência: helpers.js
// ============================================================

/**
 * Gera a chave de acesso NF-e (44 dígitos) com DV módulo 11.
 * @param {string} cnpjRaw - CNPJ com 14 dígitos (só números)
 * @param {string} cUF     - Código da UF (padrão: '35' = SP)
 * @returns {{ accessKey, nNF, cNF, issueDate }}
 */
function generateAccessKey(cnpjRaw, cUF = '35') {
  const T = cnpjRaw.replace(/\D/g, '');
  if (T.length !== 14) throw new Error('CNPJ inválido: ' + cnpjRaw);

  const now = new Date();
  const yy  = String(now.getFullYear()).slice(2);
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const nNF = String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const cNF = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');

  const raw = cUF + yy + mm + T + '55001' + nNF + '1' + cNF;

  let sum = 0, w = 2;
  for (let i = raw.length - 1; i >= 0; i--) {
    sum += Number(raw[i]) * w;
    w = w === 9 ? 2 : w + 1;
  }

  const mod = sum % 11;
  const dv  = (mod === 0 || mod === 1) ? 0 : 11 - mod;

  return { accessKey: raw + dv, nNF, cNF, issueDate: yy + mm };
}

/**
 * Preenche automaticamente os campos de chave de acesso da NF
 * com base no CNPJ do vendor selecionado.
 */
function autoFillNFKey() {
  if (!STATE.vendor) return;

  const raw = STATE.vendor.cnpj.replace(/\D/g, '');
  if (raw.length !== 14) return;

  try {
    const k = generateAccessKey(raw);

    const ec   = document.getElementById('nfChave');
    const en   = document.getElementById('nfNum');
    const ep   = document.getElementById('nfProtocolo');
    const ecnf = document.getElementById('nfCNF');

    if (ec)   ec.value   = k.accessKey;
    if (en)   en.value   = k.nNF.slice(0, 6);
    if (ecnf) ecnf.value = k.cNF;
    if (ep)   ep.value   = String(Math.floor(Math.random() * 1e15)).padStart(15, '0');
  } catch (e) {
    console.warn('[autoFillNFKey]', e.message);
  }
}

/**
 * Regenera dados da NF (nNF, cNF, Protocolo), independente
 * de ter vendor selecionado ou não.
 */
function regenerateNFData() {
  if (STATE.vendor) {
    autoFillNFKey();
    return;
  }

  // Sem vendor: gera apenas nNF, cNF e Protocolo novos
  const nNF   = String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const cNF   = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const proto = String(Math.floor(Math.random() * 1e15)).padStart(15, '0');

  const elNum   = document.getElementById('nfNum');
  const elCNF   = document.getElementById('nfCNF');
  const elProto = document.getElementById('nfProtocolo');
  const elChave = document.getElementById('nfChave');

  if (elNum)   elNum.value   = nNF.slice(0, 6);
  if (elCNF)   elCNF.value   = cNF;
  if (elProto) elProto.value = proto;
  if (elChave) elChave.value = '';
}
