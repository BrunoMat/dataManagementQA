
const assert = require('assert');

// Mock data
const mockSfRecords = [
  {
    Id: 'hubinv-1',
    Product__c: 'prod-1',
    Product__r: {
      Name: 'Product 1',
      Barcode__c: '12345',
      SKU__c: 'SKU1'
    },
    Retail_Price__c: 10.5,
    Default_Location__c: 'A-1',
    Inventories__r: {
      records: [
        {
          Id: 'inv-1',
          Hub_Location__c: 'loc-1',
          Hub_Location_Name__c: 'A-1',
          Product__r: {
            Hub_Temperature_Storage__c: 'Frozen'
          }
        }
      ]
    }
  }
];

// Simplified mapping logic from hub.service.js
function mapHubProducts(records, hubName) {
  return records.map(r => {
    const inv = r.Inventories__r?.records?.[0];
    return {
      hub_name:      hubName,
      sku:           r.Product__r?.SKU__c               || '',
      product_id:    r.Product__c                       || '',
      name:          r.Product__r?.Name                 || '',
      barcode:       r.Product__r?.Barcode__c           || '',
      location:      r.Default_Location__c              || '',
      location_id:   inv?.Hub_Location__c               || null,
      temperature:   inv?.Product__r?.Hub_Temperature_Storage__c || '',
      price:         r.Retail_Price__c                  || 0,
      salesforce_id: r.Id,
      inventory_id:  inv?.Id || null,
      synced_at:     new Date()
    };
  });
}

// Simplified mapping logic from to.service.js
function mapToInventory(products, locationName) {
  return products.map(p => ({
    inventoryId:    p.inventory_id,
    productId:      p.product_id,
    productName:    p.name,
    barcode:        p.barcode,
    sku:            p.sku,
    temperature:    p.temperature,
    hubInventoryId: p.salesforce_id,
    hubLocationId:  p.location_id || '', 
    locationName:   locationName,
  }));
}

async function runTest() {
  console.log('Running mapping validation test...');
  
  const mappedHubProducts = mapHubProducts(mockSfRecords, 'SAO022');
  console.log('Mapped Hub Products:', JSON.stringify(mappedHubProducts, null, 2));
  
  assert.strictEqual(mappedHubProducts[0].location_id, 'loc-1');
  assert.strictEqual(mappedHubProducts[0].temperature, 'Frozen');
  
  const mappedToInventory = mapToInventory(mappedHubProducts, 'SAO022');
  console.log('Mapped TO Inventory:', JSON.stringify(mappedToInventory, null, 2));
  
  assert.strictEqual(mappedToInventory[0].hubLocationId, 'loc-1');
  assert.strictEqual(mappedToInventory[0].inventoryId, 'inv-1');
  
  console.log('Test PASSED!');
}

runTest().catch(console.error);
