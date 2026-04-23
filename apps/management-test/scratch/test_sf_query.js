
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const sf = require('../../../packages/salesforce/index');

async function testQuery() {
  const hubName = 'SAO022'; // Use a known hub name from .env or default
  console.log(`Testing query for Hub: ${hubName}`);
  
  const soql = `SELECT Id, Product__c, Product__r.Name, Product__r.Barcode__c, Product__r.SKU__c, ` +
    `Retail_Price__c, Default_Location__c, Product__r.Public_Image_URL__c, ` +
    `(SELECT Id, Hub_Location_Name__c, Product__r.Hub_Temperature_Storage__c FROM Inventories__r WHERE Default_Location__c != '---' LIMIT 1) ` +
    `FROM Hub_Inventory__c ` +
    `WHERE Hub__r.Name = '${hubName}'`;
    
  try {
    const data = await sf.query(soql);
    console.log('Query Success!');
    console.log('Total Records:', data.totalSize);
    if (data.records.length > 0) {
        console.log('First Record Inventories__r:', JSON.stringify(data.records[0].Inventories__r, null, 2));
    }
  } catch (err) {
    console.error('Query Failed!');
    if (err.response) {
        console.error('Status:', err.response.status);
        console.error('Data:', JSON.stringify(err.response.data, null, 2));
    } else {
        console.error('Error:', err.message);
    }
  }
}

testQuery();
