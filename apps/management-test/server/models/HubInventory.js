const mongoose = require('mongoose');

const hubInventorySchema = new mongoose.Schema({
  hub_name: { type: String, required: true, index: true },
  sku: { type: String, required: true, index: true },
  product_id: String, // Product__c ID
  name: String,
  barcode: String,
  location: String,
  location_id: String, // Hub_Location__c ID
  temperature: String,
  price: { type: Number, default: 0 },
  salesforce_id: { type: String, required: true, unique: true },
  inventory_id: String, // Para TO (Inventory__c ID)
  synced_at: { type: Date, default: Date.now }
}, { timestamps: true });

// Índice composto para busca rápida por Hub + SKU
hubInventorySchema.index({ hub_name: 1, sku: 1 });

module.exports = mongoose.model('HubInventory', hubInventorySchema);
