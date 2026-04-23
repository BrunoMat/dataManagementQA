const mongoose = require('mongoose');

const hubVendorSchema = new mongoose.Schema({
  hub_id: { type: String, required: true, index: true }, // Local ID or name
  vendor_id: { type: String, required: true, index: true }, // Local ID
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure a single connection per hub/vendor pair
hubVendorSchema.index({ hub_id: 1, vendor_id: 1 }, { unique: true });

module.exports = mongoose.model('HubVendor', hubVendorSchema);
