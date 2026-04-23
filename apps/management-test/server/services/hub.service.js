// ============================================================
//  apps/management-test/server/services/hub.service.js
// ============================================================
'use strict';

const sf = require('../../../../packages/salesforce/index');
const HubInventory = require('../models/HubInventory');

/**
 * Busca produtos de um Hub com Cache-First (MongoDB -> Salesforce)
 * @param {string} hubName - Nome do Hub (ex: SAO903)
 * @param {boolean} forceSync - Se true, ignora o cache e busca no SF
 */
async function getHubProducts(hubName, forceSync = false) {
  if (!forceSync) {
    const cached = await HubInventory.find({ hub_name: hubName });
    if (cached.length > 0) {
      console.log(`[hub.service] Retornando ${cached.length} produtos do cache MongoDB para ${hubName}`);
      return cached;
    }
  }

  console.log(`[hub.service] Buscando produtos no Salesforce para Hub: ${hubName}`);
  
  // Consulta unificada que tenta pegar dados tanto de Hub_Inventory__c quanto de Inventory__c associado
  const data = await sf.query(
    `SELECT Id, Product__c, Product__r.Name, Product__r.Barcode__c, Product__r.SKU__c, ` +
    `Retail_Price__c, Default_Location__c, Product__r.Public_Image_URL__c, ` +
    `(SELECT Id, Hub_Location__c, Hub_Location_Name__c, Product__r.Hub_Temperature_Storage__c FROM Inventory__r LIMIT 1) ` +
    `FROM Hub_Inventory__c ` +
    `WHERE Hub__r.Name = '${hubName.replace(/'/g, "\\'")}'`
  );

  const products = (data.records || []).map(r => {
    const inv = r.Inventory__r?.records?.[0];
    return {
      hub_name:      hubName,
      sku:           r.Product__r?.SKU__c               || '',
      product_id:    r.Product__c                       || '',
      name:          r.Product__r?.Name                 || '',
      barcode:       r.Product__r?.Barcode__c           || '',
      location:      r.Default_Location__c              || '',
      location_id:   inv?.Hub_Location__c               || null,
      temperature:   inv?.Product__r?.Hub_Temperature_Storage__c || '',
      price:         r.Retail_Price__c                  || 0,
      salesforce_id: r.Id,
      inventory_id:  inv?.Id || null,
      synced_at:     new Date()
    };
  });

  // Atualiza cache
  if (products.length > 0) {
    const bulkOps = products.map(p => ({
      updateOne: {
        filter: { salesforce_id: p.salesforce_id },
        update: { $set: p },
        upsert: true
      }
    }));
    await HubInventory.bulkWrite(bulkOps);
    console.log(`[hub.service] Cache MongoDB atualizado para hub: ${hubName}`);
  }

  return products;
}

/**
 * Busca um único produto por SKU em um hub específico (Cache-First)
 */
async function getProductBySku(hubName, sku, forceSync = false) {
  if (!forceSync) {
    const cached = await HubInventory.findOne({ hub_name: hubName, sku: sku });
    if (cached) return cached;
  }

  // Se não achar no cache, sincroniza o hub todo (ou ao menos garante a busca)
  const all = await getHubProducts(hubName, true);
  return all.find(p => p.sku === sku) || null;
}

module.exports = {
  getHubProducts,
  getProductBySku
};
