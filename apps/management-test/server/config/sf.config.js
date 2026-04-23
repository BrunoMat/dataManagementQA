// ============================================================
//  apps/management-test/server/config/sf.config.js
//  Configurações Salesforce específicas do app Management Test.
//  Todas as variáveis vêm do .env na raiz do monorepo.
// ============================================================
'use strict';

module.exports = {
  baseUrl:        process.env.SF_BASE_URL,
  apiVersion:     process.env.SF_API_VERSION    || 'v56.0',
  clientId:       process.env.SF_CLIENT_ID,
  clientSecret:   process.env.SF_CLIENT_SECRET,
  buyerId:        process.env.SF_BUYER_ID,
  limitProdutos:  process.env.SF_LIMIT_PRODUTOS ? Number(process.env.SF_LIMIT_PRODUTOS) : undefined,
  uomDefault:     process.env.SF_UOM_DEFAULT            || 'ea',

  // UOMs válidos no sistema
  uomOptions: ['ea', 'Pallet', 'Primary Case', 'Secondary Case', 'Weight'],
};
