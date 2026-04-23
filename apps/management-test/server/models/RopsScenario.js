const mongoose = require('mongoose');

const ropsScenarioSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  icon: { type: String, default: '📋' },
  color: { type: String, default: '#3b82f6' },
  preset: { type: Boolean, default: false },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('RopsScenario', ropsScenarioSchema);
