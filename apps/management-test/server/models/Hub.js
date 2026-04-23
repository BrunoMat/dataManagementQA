const mongoose = require('mongoose');

const hubSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  city: String,
  uf: String,
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Hub', hubSchema);
