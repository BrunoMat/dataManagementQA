// ============================================================
//  packages/salesforce/index.js
//  Cliente Salesforce compartilhado — OAuth2 client_credentials.
//
//  IMPORTANTE: process.env é lido DENTRO de cada função,
//  nunca no topo do módulo. Isso garante que o dotenv já
//  tenha carregado quando a primeira chamada acontecer.
// ============================================================
'use strict';

const axios = require('axios');
const qs    = require('qs');

// Token cache singleton por processo
let _token    = null;
let _tokenExp = 0;

// ── Helpers de config (lidos on-demand) ───────────────────
function sfBase()    { return process.env.SF_BASE_URL; }
function sfVersion() { return process.env.SF_API_VERSION || 'v56.0'; }

// ── Validação de ambiente ─────────────────────────────────
function assertConfig() {
  if (!sfBase()) {
    throw new Error(
      '[salesforce] SF_BASE_URL não definida. ' +
      'Verifique o .env na raiz do monorepo (jokr/.env).'
    );
  }
  if (!process.env.SF_CLIENT_ID || !process.env.SF_CLIENT_SECRET) {
    throw new Error(
      '[salesforce] SF_CLIENT_ID ou SF_CLIENT_SECRET não definidos no .env.'
    );
  }
}

/**
 * Obtém (ou renova) o access token via client_credentials.
 * Renova automaticamente 5 min antes de expirar.
 */
async function getToken() {
  if (_token && Date.now() < _tokenExp) return _token;

  assertConfig();
  console.log('[salesforce] Renovando access token…');

  const res = await axios.post(
    `${sfBase()}/services/oauth2/token`,
    qs.stringify({
      grant_type:    'client_credentials',
      client_id:     process.env.SF_CLIENT_ID,
      client_secret: process.env.SF_CLIENT_SECRET,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  _token    = res.data.access_token;
  const exp = (res.data.expires_in ? res.data.expires_in * 1000 : 3_600_000) - 300_000;
  _tokenExp = Date.now() + exp;

  console.log('[salesforce] Token OK. Expira:', new Date(_tokenExp).toISOString());
  return _token;
}

/** Invalida o token em cache — força renovação na próxima chamada. */
function invalidateToken() {
  _token    = null;
  _tokenExp = 0;
  console.log('[salesforce] Token invalidado.');
}

/**
 * Executa uma request autenticada na SF API.
 * Em caso de 401 faz uma renovação de token e tenta de novo.
 */
async function sfRequest(method, endpoint, data = null, params = null) {
  const doRequest = async () => {
    const token = await getToken();
    return axios({
      method,
      url:     `${sfBase()}/services/data/${sfVersion()}${endpoint}`,
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      params,
      data,
    });
  };

  try {
    return await doRequest();
  } catch (err) {
    // Se 401 → token expirou fora do prazo previsto → renova e tenta uma vez
    if (err.response?.status === 401) {
      console.warn('[salesforce] 401 recebido — renovando token e retentando…');
      invalidateToken();
      return doRequest();
    }
    throw err;
  }
}

/**
 * Atalho para SOQL queries.
 * @param {string} soql
 * @returns {{ totalSize, done, records[] }}
 */
async function query(soql) {
  const res = await sfRequest('GET', `/query?q=${encodeURIComponent(soql)}`);
  return res.data;
}

/**
 * Atalho para Composite API.
 * @param {object} body - { allOrNone, compositeRequest[] }
 */
async function composite(body) {
  const res = await sfRequest('POST', '/composite', body);
  return res.data;
}

/**
 * Verifica conectividade SF e retorna status do token.
 * Usado pelo frontend para confirmar que a autenticação está ok
 * antes de qualquer operação crítica.
 */
async function ping() {
  assertConfig();
  const token = await getToken();
  return {
    ok:      true,
    preview: token.slice(0, 20) + '…',
    base:    sfBase(),
    version: sfVersion(),
    expires: new Date(_tokenExp).toISOString(),
  };
}

module.exports = { getToken, sfRequest, query, composite, ping, invalidateToken };
