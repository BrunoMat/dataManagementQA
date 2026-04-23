// ============================================================
//  apps/management-test/server/services/inventory.service.js
//
//  Busca produtos em estoque de um HUB via Inventory__c.
//  Espelha getProductsStock() do criacao_PO.js:
//    SELECT Product__c FROM Inventory__c
//    WHERE Hub_Location__r.Name = '${hub}-Stock'
// ============================================================
'use strict';

const sf = require('../../../../packages/salesforce/index');

/**
 * Retorna array de Product__c IDs disponíveis no estoque do HUB.
 * @param {string} hubName - ex: 'SAO903'
 * @returns {Promise<string[]>}
 */
async function getProductsInStock(hubName) {
  const data = await sf.query(
    `SELECT Product__c FROM Inventory__c ` +
    `WHERE Hub_Location__r.Name = '${hubName}-Stock' AND Product__r.Status__c = 'Active'`
  );

  if (data.totalSize === 0) {
    console.warn(`[inventory] Nenhum produto em estoque para hub '${hubName}-Stock'`);
    return [];
  }

  return data.records.map(r => r.Product__c);
}

module.exports = { getProductsInStock };
