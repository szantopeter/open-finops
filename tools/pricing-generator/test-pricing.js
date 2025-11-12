#!/usr/bin/env node
const { PricingClient, GetProductsCommand } = require('@aws-sdk/client-pricing');

// Disable TLS verification for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new PricingClient({ region: 'us-east-1' });

async function getProductsForInstance(instanceType, regionCode) {
  const location = require('./region-mapping.json')[regionCode] || regionCode;
  const baseFilters = [
    { Type: 'TERM_MATCH', Field: 'instanceType', Value: instanceType },
    { Type: 'TERM_MATCH', Field: 'location', Value: location }
  ];

  let products = [];
  try {
    const params = { ServiceCode: 'AmazonRDS', Filters: baseFilters.concat({ Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Database Instance' }), FormatVersion: 'aws_v1', MaxResults: 100 };
    const cmd = new GetProductsCommand(params);
    const resp = await client.send(cmd);
    products = resp.PriceList ? resp.PriceList.map(p => JSON.parse(p)) : [];
  } catch (err) {
    console.error('Error:', err.message);
    return [];
  }

  return products;
}

async function main() {
  console.log('Fetching products for db.r5.xlarge in eu-west-1...');
  const products = await getProductsForInstance('db.r5.xlarge', 'eu-west-1');

  console.log(`Found ${products.length} products`);

  // Log all oracle products
  const allOracle = products.filter(p => {
    const attrs = (p && p.product && p.product.attributes) || {};
    return (attrs.databaseEngine || '').toLowerCase().includes('oracle');
  });

  console.log(`Found ${allOracle.length} oracle products:`);
  allOracle.forEach((p, i) => {
    const attrs = (p && p.product && p.product.attributes) || {};
    console.log(`  ${i}: engine=${attrs.databaseEngine}, edition=${attrs.databaseEdition}, license=${attrs.licenseModel}, deployment=${attrs.deploymentOption}`);
  });

  if (allOracle.length > 0) {
    // Find the single-az standard two byol
    const target = allOracle.find((p, i) => {
      const attrs = (p && p.product && p.product.attributes) || {};
      return attrs.deploymentOption === 'Single-AZ' && attrs.databaseEdition === 'Standard Two' && attrs.licenseModel === 'Bring your own license';
    });
    if (target) {
      console.log('Raw Single-AZ Oracle SE2 BYOL product data:');
      console.log(JSON.stringify(target, null, 2));
    } else {
      console.log('Target product not found, showing first single-az:');
      const singleAz = allOracle.find((p, i) => {
        const attrs = (p && p.product && p.product.attributes) || {};
        return attrs.deploymentOption === 'Single-AZ';
      });
      if (singleAz) {
        console.log(JSON.stringify(singleAz, null, 2));
      }
    }
  }
}

main().catch(console.error);