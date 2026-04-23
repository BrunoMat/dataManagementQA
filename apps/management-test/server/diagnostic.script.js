// apps/management-test/server/diagnostic.script.js
'use strict';

const mongoose = require('mongoose');
const Vendor = require('./models/Vendor');
const HubVendor = require('./models/HubVendor');
const Product = require('./models/Product');

async function runDiagnostic() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/management-test');
  console.log('--- DIAGNÓSTICO DE DADOS ---');

  const vendors = await Vendor.find({});
  console.log(`Total de Vendors: ${vendors.length}`);
  vendors.forEach(v => {
    console.log(` - ID: ${v.id} | Name: ${v.name} | SF ID: ${v.sf_account_id || 'N/A'}`);
  });

  const links = await HubVendor.find({});
  console.log(`\nTotal de Vínculos (HubVendor): ${links.length}`);
  links.forEach(l => {
    console.log(` - Hub: ${l.hub_id} | VendorID: ${l.vendor_id}`);
  });

  const products = await Product.aggregate([
    { $group: { _id: "$vendor_id", count: { $sum: 1 } } }
  ]);
  console.log(`\nProdutos em Cache por Vendor ID:`);
  products.forEach(p => {
    console.log(` - VendorID: ${p._id} | Produtos: ${p.count}`);
  });

  process.exit(0);
}

runDiagnostic().catch(err => {
  console.error(err);
  process.exit(1);
});
