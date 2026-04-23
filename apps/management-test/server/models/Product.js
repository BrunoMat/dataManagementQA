const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sfId: { type: String, required: true, unique: true }, // sfId is the primary key from Salesforce
  vendor_id: { type: String, required: true, index: true },
  hub_id: { type: String, index: true }, // Optional: link to a specific hub if needed
  name: { type: String, required: true },
  sku: { type: String, index: true },
  barcode: String,
  cost: Number,
  uom: String,
  active: { type: Boolean, default: true },
  synced_at: { type: Date, default: Date.now }
}, { timestamps: true });

// Create a compound index for vendor and hub if products are hub-specific
productSchema.index({ vendor_id: 1, hub_id: 1 });

module.exports = mongoose.model('Product', productSchema);
