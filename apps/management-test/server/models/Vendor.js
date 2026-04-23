const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  cnpj: { type: String, index: true },
  sf_account_id: { type: String, index: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);
