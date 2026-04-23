// ============================================================
//  apps/management-test/server/services/nfkey.service.js
//
//  Gera a Chave de Acesso NF-e (44 dígitos + DV módulo 11)
//  conforme padrão SEFAZ — exatamente igual ao script Postman.
//
//  Estrutura da chave (43 dígitos + 1 DV):
//    cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9)
//    + tpEmis(1) + cNF(8) + cDV(1)
//
//  CNPJ do emitente obrigatório — validado com 14 dígitos.
// ============================================================
'use strict';

/**
 * Gera nNF aleatório (9 dígitos, zero-padded).
 */
function generateNNF() {
  return String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
}

/**
 * Gera cNF aleatório (8 dígitos, zero-padded).
 */
function generateCNF() {
  return String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
}

/**
 * Calcula o DV módulo 11 conforme padrão SEFAZ.
 * @param {string} key43 - chave sem o DV (43 dígitos)
 * @returns {number} dígito verificador (0..9)
 */
function calcDV(key43) {
  let sum    = 0;
  let weight = 2;

  for (let i = key43.length - 1; i >= 0; i--) {
    sum    += Number(key43[i]) * weight;
    weight  = weight === 9 ? 2 : weight + 1;
  }

  const mod = sum % 11;
  return (mod === 0 || mod === 1) ? 0 : 11 - mod;
}

/**
 * Gera a chave de acesso completa (44 dígitos) para NF-e mod 55.
 *
 * @param {object} params
 * @param {string} params.cnpj        - CNPJ do emitente (14 dígitos, só números)
 * @param {string} [params.cUF]       - código UF  (padrão: '31' = MG, usar '35' = SP)
 * @param {string} [params.issueDate] - AAMM (ex: '2604'). Se omitido, usa data atual.
 * @param {string} [params.nNF]       - número da NF (9 dígitos). Se omitido, gera aleatório.
 * @param {string} [params.cNF]       - código numérico (8 dígitos). Se omitido, gera aleatório.
 * @param {string} [params.serie]     - série da NF (padrão: '001')
 * @param {string} [params.tpEmis]    - tipo de emissão (padrão: '1')
 *
 * @returns {{ accessKey: string, nNF: string, cNF: string, issueDate: string }}
 */
function generateAccessKey({
  cnpj,
  cUF      = '35',   // SP
  issueDate,
  nNF,
  cNF,
  serie    = '001',
  tpEmis   = '1',
} = {}) {
  const TAX_ID = String(cnpj || '').replace(/\D/g, '');

  if (TAX_ID.length !== 14) {
    throw new Error(`CNPJ inválido para geração da chave de acesso. Recebido: "${cnpj}"`);
  }

  // AAMM — usa data atual se não informado
  const now  = new Date();
  const date = issueDate
    || (String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0'));

  const _nNF  = nNF  || generateNNF();
  const _cNF  = cNF  || generateCNF();
  const _serie = String(serie).padStart(3, '0');

  // 43 dígitos (sem DV)
  // cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8)
  const key43 = cUF + date + TAX_ID + '55' + _serie + _nNF + tpEmis + _cNF;

  if (key43.length !== 43) {
    throw new Error(`Chave de 43 dígitos inválida (${key43.length} chars): ${key43}`);
  }

  const dv        = calcDV(key43);
  const accessKey = key43 + dv;

  return {
    accessKey,           // 44 dígitos — chave completa
    nNF:       _nNF,     // número da NF (9 dígitos)
    cNF:       _cNF,     // código numérico (8 dígitos)
    issueDate: date,     // AAMM
    cUF,
    serie:     _serie,
  };
}

module.exports = { generateAccessKey, generateNNF, generateCNF, calcDV };
