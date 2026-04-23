// ============================================================
//  apps/management-test/server/index.js
//  Entry point do servidor Express — app Management Test.
// ============================================================
'use strict';

const path = require('path');

// ── .env: tenta raiz do monorepo (3 níveis acima de server/)
// Estrutura: jokr/apps/management-test/server/index.js
//                  ^1   ^2   ^3  ← __dirname
// Logo a raiz fica em ../../../  (3 passos)
const envPath = path.resolve(__dirname, '../../..', '.env');
const dotenvResult = require('dotenv').config({ path: envPath });

if (dotenvResult.error) {
  // Fallback: tenta o diretório corrente (caso rode direto de apps/management-test)
  require('dotenv').config();
}

const express = require('express');
const cors    = require('cors');

const mongoose = require('mongoose');

const logger           = require('./middleware/logger');
const { errorHandler } = require('./middleware/errorHandler');
const sfRoutes         = require('./routes/sf.routes');
const vendorRoutes     = require('./routes/vendor.routes');
const poRoutes         = require('./routes/po.routes');
const toRoutes         = require('./routes/to.routes');
const ropsRoutes       = require('./routes/rops.routes');
const testsRoutes      = require('./routes/tests.routes');
const reservakiRoutes  = require('./routes/reservaki.routes');
const hubrRoutes       = require('./routes/hubr.routes');
const hubRoutes        = require('./routes/hub.routes');
const wmsRoutes        = require('./routes/wms.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(logger);

// Serve client
app.use(express.static(path.join(__dirname, '../client')));
app.use('/styles',     express.static(path.join(__dirname, '../client/styles')));
app.use('/lib',        express.static(path.join(__dirname, '../client/lib')));
app.use('/components', express.static(path.join(__dirname, '../client/components')));

// API
app.use('/api/sf',      sfRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/po',      poRoutes);
app.use('/api/to',      toRoutes);
app.use('/api/rops',    ropsRoutes);
app.use('/api/tests',     testsRoutes);
app.use('/api/reservaki', reservakiRoutes);
app.use('/api/hubr',      hubrRoutes);
app.use('/api/hubs',      hubRoutes);
app.use('/api/wms',        wmsRoutes);

// SPA catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/pages/index.html'));
});

app.use(errorHandler);

// ── Conexão MongoDB ─────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/management_test';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB:', MONGO_URI))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ── Start com tratamento de porta ocupada ──────────────────
const server = app.listen(PORT, () => {
  const sfBase = process.env.SF_BASE_URL || '(não definido — preencha o .env)';
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log(`║  🧪 Management Test  →  http://localhost:${PORT}  ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`   .env   : ${envPath}`);
  console.log(`   SF     : ${sfBase}`);
  console.log(`   API    : ${process.env.SF_API_VERSION || 'v56.0'}`);
  console.log(`   Env    : ${process.env.NODE_ENV || 'development'}\n`);
  console.log('   Rotas:');
  console.log('   GET  /api/sf/ping');
  console.log('   GET  /api/vendors/by-hub');
  console.log('   GET  /api/vendors/products');
  console.log('   GET  /api/vendors/compatible');
  console.log('   POST /api/po/create-full');
  console.log('   POST /api/po/create');
  console.log('   GET  /api/po/preview-key\n');
  console.log('   GET  /api/to/cross-inventory');
  console.log('   POST /api/to/create\n');
  console.log('   POST /api/rops/deliveries');
  console.log('   PUT  /api/rops/deliveries/pick');
  console.log('   PUT  /api/rops/deliveries/cancel');
  console.log('   GET  /api/rops/hub-products');
  console.log('   GET  /api/rops/product-by-sku\n');
  console.log('   POST /api/tests/trigger');
  console.log('   GET  /api/tests/status');
  console.log('   GET  /api/tests/browserstack\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌  Porta ${PORT} já está em uso.`);
    console.error(`    Opções:`);
    console.error(`      1) Mude a porta: PORT=3001 npm start`);
    console.error(`      2) Libere a porta: lsof -ti:${PORT} | xargs kill -9\n`);
  } else {
    console.error('\n❌  Erro ao iniciar servidor:', err.message);
  }
  process.exit(1);
});
