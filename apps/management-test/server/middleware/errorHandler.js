// ============================================================
//  middleware/errorHandler.js
//  Trata erros de forma centralizada.
//  Diferencia erros de negócio (4xx) de erros inesperados (5xx).
// ============================================================

function errorHandler(err, req, res, next) {
  // Erro vindo do Axios (Salesforce devolveu erro HTTP)
  if (err.response) {
    const status = err.response.status || 502;
    const body   = err.response.data;
    console.error(`[SF ERROR ${status}]`, JSON.stringify(body));
    return res.status(status).json({
      ok:     false,
      source: 'salesforce',
      error:  body,
    });
  }

  // Erro de negócio com status code (ex: Object.assign(new Error(...), {status: 404}))
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ ok: false, error: err.message });
  }

  // Erro de negócio lançado manualmente (new Error('...'))
  if (err.isBusinessError) {
    return res.status(400).json({ ok: false, error: err.message });
  }

  // Erro de rede (DNS, timeout, conexão recusada)
  if (err.code === 'EAI_AGAIN' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    console.error('[NETWORK ERROR]', err.code, err.message);
    return res.status(503).json({ ok: false, error: `Erro de conexão com Salesforce: ${err.code}. Verifique a URL e sua conexão de rede.` });
  }

  // Erro inesperado — retorna mensagem real para facilitar debug
  console.error('[UNHANDLED ERROR]', err.message, err.stack);
  res.status(500).json({ ok: false, error: err.message || 'Erro interno do servidor.' });
}

/** Wrapper para rotas async — evita try/catch repetitivo */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Lança um erro de negócio (4xx) */
function businessError(msg) {
  const err = new Error(msg);
  err.isBusinessError = true;
  throw err;
}

module.exports = { errorHandler, asyncHandler, businessError };
