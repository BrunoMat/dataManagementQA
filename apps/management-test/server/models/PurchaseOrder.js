const mongoose = require('mongoose');

const poSchema = new mongoose.Schema({
  hub_id: { type: String, required: true, index: true },
  vendor_id: { type: String, required: true, index: true },
  items: [
    {
      sfId: String,
      name: String,
      sku: String,
      qty: Number,
      cost: Number,
      total: Number
    }
  ],
  total_amount: Number,
  status: { type: String, default: 'draft' }, // draft, created, synced
  sf_po_id: String, // Salesforce ID if created
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', poSchema);
