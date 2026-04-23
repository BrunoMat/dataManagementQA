const mongoose = require('mongoose');

const ropsAddressSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  label: String,
  formatted: String,
  street: String,
  number: String,
  complement: String,
  neighborhood: String,
  city: String,
  lat: Number,
  lng: Number
}, { timestamps: true });

module.exports = mongoose.model('RopsAddress', ropsAddressSchema);
