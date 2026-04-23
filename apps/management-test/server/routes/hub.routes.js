'use strict';

const express = require('express');
const Hub = require('../models/Hub');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/hubs
router.get('/', asyncHandler(async (req, res) => {
  const hubs = await Hub.find({ active: true });
  res.json(hubs);
}));

// POST /api/hubs
router.post('/', asyncHandler(async (req, res) => {
  const hub = new Hub(req.body);
  await hub.save();
  res.status(201).json(hub);
}));

// DELETE /api/hubs/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  await Hub.deleteOne({ id: req.params.id });
  res.status(204).end();
}));

module.exports = router;
