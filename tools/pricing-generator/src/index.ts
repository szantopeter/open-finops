#!/usr/bin/env node

import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { loadSharedConfigFiles } from '@aws-sdk/shared-ini-file-loader';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PricingClient, GetProductsCommand } from '@aws-sdk/client-pricing';
import type { Filter } from '@aws-sdk/client-pricing';

function parseArgs(): string {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-csv' && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return 'cloudability-rds-reservations.csv'; // Default
}

async function main(): Promise<void> {
  const csvFile = parseArgs();
  await awsLogin();
  const uniqueKeys = parseCloudabilityCSV(csvFile);
  console.log('Unique region/product/deployment/instance-family combinations:');
  uniqueKeys.forEach(key => console.log(key));

  // Generate pricing CSVs for each category
  for (const key of uniqueKeys) {
    const result = await generatePricingCSV(key);
    if (result.records === 0) {
      console.log(`ERROR: ${key} - 0 records written to ${result.filePath}`);
      console.log('Stopping execution due to error.');
      process.exit(1);
    }
  }
}

main();

async function awsLogin() {
  try {
    console.log('Loading AWS shared config files...');
    const config = await loadSharedConfigFiles();
    const profiles = Object.keys(config.configFile || {});
    if (profiles.length === 0) {
      throw new Error('No AWS profiles found in ~/.aws/config');
    }
    const firstProfile = profiles[0];
    console.log(`Using AWS profile: ${firstProfile}`);

    // Set the profile for the client
    process.env.AWS_PROFILE = firstProfile;

    // Create STS client (region will be loaded from profile or default)
    console.log('Creating STS client...');
    let client = new STSClient({});

    let response;
    try {
      console.log('Getting caller identity...');
      const command = new GetCallerIdentityCommand({});
      response = await client.send(command);
      console.log('Got caller identity.');
    } catch (apiError: any) {
      console.log('Error getting caller identity:', apiError.message);
      if (apiError.message && (apiError.message.includes('Token is expired') || apiError.message.includes('not found or is invalid'))) {
        console.log('SSO session invalid or expired, running aws sso login...');
        await new Promise<void>((resolve, reject) => {
          const loginProcess = spawn('aws', ['sso', 'login', '--profile', firstProfile], {
            stdio: 'inherit'
          });
          loginProcess.on('close', (code) => {
            if (code === 0) {
              console.log('aws sso login successful.');
              resolve();
            } else {
              console.error(`aws sso login failed with code ${code}`);
              reject(new Error(`aws sso login failed with code ${code}`));
            }
          });
          loginProcess.on('error', (err) => {
            console.error('Failed to start aws sso login process:', err);
            reject(err);
          });
        });
        console.log('Login completed, retrying API call...');
        // Create a new client to pick up fresh credentials
        client = new STSClient({});
        const command = new GetCallerIdentityCommand({});
        response = await client.send(command);
      } else {
        throw apiError;
      }
    }

    console.log('AWS API Call Successful!');
    console.log('Account ID:', response.Account);
    console.log('User ID:', response.UserId);
    console.log('ARN:', response.Arn);
  } catch (error) {
    console.error('Error in awsLogin:', error);
    process.exit(1);
  }
}

function normalizeDatabaseEdition(edition: string): string {
  const lower = edition.toLowerCase();
  if (lower === 'ee' || lower.includes('enterprise')) return 'Enterprise';
  if (lower.includes('standard two') || lower.includes('se2')) return 'Standard Two';
  if (lower.includes('standard one') || lower.includes('se1')) return 'Standard One';
  if (lower.includes('standard')) return 'Standard';
  if (lower.includes('express')) return 'Express';
  if (lower.includes('web')) return 'Web';
  return edition;
}

async function generatePricingCSV(key: string) {
  const [region, productKey, deployment, instanceFamily] = key.split('/');
  console.log(`Generating pricing CSV for ${key}`);

  const pricingClient = new PricingClient({ region: 'us-east-1' });

  const deploymentApi = deployment === 'multi-az' ? 'Multi-AZ' : 'Single-AZ';
  const productParts = productKey.split('-');
  const engine = productKey.startsWith('aurora') ? productKey : productParts[0];
  const edition = productParts.length > 2 ? productParts[1] : '';
  const license = productParts[productParts.length - 1];

  const isAurora = productKey.startsWith('aurora');
  let productFamily: string | undefined;
  let databaseEngine: string;
  if (isAurora) {
    if (productKey === 'aurora-postgresql') {
      productFamily = undefined; // No productFamily for Aurora
      databaseEngine = 'Aurora PostgreSQL';
    } else if (productKey === 'aurora-mysql') {
      productFamily = undefined;
      databaseEngine = 'Aurora MySQL';
    } else {
      productFamily = 'Database Instance';
      databaseEngine = engine;
    }
  } else {
    productFamily = 'Database Instance';
    databaseEngine = engine;
  }

  const filters: Filter[] = [
    { Type: 'TERM_MATCH', Field: 'regionCode', Value: region },
    { Type: 'TERM_MATCH', Field: 'serviceCode', Value: 'AmazonRDS' },
  ];
  if (productFamily) {
    filters.push({ Type: 'TERM_MATCH', Field: 'productFamily', Value: productFamily });
  }
  filters.push({ Type: 'TERM_MATCH', Field: 'databaseEngine', Value: databaseEngine });
  if (edition) {
    const normalizedEdition = normalizeDatabaseEdition(edition);
    filters.push({ Type: 'TERM_MATCH', Field: 'databaseEdition', Value: normalizedEdition });
  }

  console.log('Filters:', filters);

  try {
    let products: any[] = [];
    let nextToken: string | undefined;
    let pageNum = 1;
    do {
      console.log(`Fetching page ${pageNum} with nextToken: ${nextToken ? '...' + nextToken.slice(-10) : 'null'}`);
      const command = new GetProductsCommand({
        ServiceCode: 'AmazonRDS',
        Filters: filters,
        NextToken: nextToken,
      });
      const response = await pricingClient.send(command);
      console.log(`Received page ${pageNum}. Products in page: ${response.PriceList?.length || 0}`);
      if (response.PriceList) {
        products = products.concat(response.PriceList.map((p: string) => JSON.parse(p)));
      }
      nextToken = response.NextToken;
      pageNum++;
    } while (nextToken);

    console.log(`Found ${products.length} total products for ${key} before filtering`);

    const logDir = join(__dirname, '../logs');
    mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, `products_${key.replace(/\//g, '_')}.json`);
    writeFileSync(logFile, JSON.stringify(products, null, 2));
    console.log(`Logged raw products to ${logFile}`);

    const csvLines: string[] = ['type,region,instance,deployment,engine,license,term,purchaseOption,upfront,hourly,daily,adjustedAmortisedHourly,adjustedAmortisedDaily,sku'];

    for (const product of products) {
      const attrs = product.product.attributes;
      const instanceType = attrs.instanceType;

      if (!instanceType || !instanceType.startsWith(`db.${instanceFamily}`)) continue;
      if (attrs.deploymentOption !== deploymentApi) continue;
      
      const apiEdition = attrs.databaseEdition;
      const normalizedEdition = normalizeDatabaseEdition(edition);
      if (edition && apiEdition !== normalizedEdition) continue;

      if (license === 'byol' && attrs.licenseModel !== 'Bring your own license') continue;
      if (license === 'li' && attrs.licenseModel !== 'License Included') continue;

      console.log(`Processing matched product: ${instanceType} - ${attrs.deploymentOption} - ${attrs.databaseEdition} - ${attrs.licenseModel}`);

      const sku = product.product.sku;

      // OnDemand
      const onDemand = product.terms.OnDemand;
      if (onDemand) {
        for (const onDemandKey in onDemand) {
          const onDemandTerm = onDemand[onDemandKey];
          if (onDemandTerm.sku !== sku) continue;
          for (const pdKey in onDemandTerm.priceDimensions) {
            const pd = onDemandTerm.priceDimensions[pdKey];
            if (pd.unit === 'Hrs') {
              const hourly = parseFloat(pd.pricePerUnit.USD);
              const daily = hourly * 24;
              csvLines.push(`onDemand,${region},${instanceType},${deployment},${engine},${license},,,,${hourly.toFixed(6)},${daily.toFixed(6)},${hourly.toFixed(6)},${daily.toFixed(6)},${sku}`);
            }
          }
        }
      }

      // Reserved
      const reserved = product.terms.Reserved;
      if (reserved) {
        for (const reservedKey in reserved) {
          const reservedTerm = reserved[reservedKey];
          if (reservedTerm.sku !== sku) continue;
          
          const termAttributes = reservedTerm.termAttributes;
          if (!termAttributes) continue;

          const leaseContractLength = termAttributes.LeaseContractLength;
          const purchaseOption = termAttributes.PurchaseOption;

          let hourly = 0;
          let upfront = 0;

          for (const pdKey in reservedTerm.priceDimensions) {
            const pd = reservedTerm.priceDimensions[pdKey];
            const price = parseFloat(pd.pricePerUnit.USD);
            if (pd.unit === 'Hrs') {
              hourly = price;
            } else if (pd.unit === 'Quantity') {
              upfront = price;
            }
          }

          const daily = hourly * 24;
          const termYears = leaseContractLength === '1yr' ? 1 : (leaseContractLength === '3yr' ? 3 : 0);
          const totalHours = termYears * 365.25 * 24;
          const effectiveHourly = totalHours > 0 ? (upfront / totalHours) + hourly : hourly;
          const effectiveDaily = effectiveHourly * 24;

          csvLines.push(`savings,${region},${instanceType},${deployment},${engine},${license},${leaseContractLength},${purchaseOption},${upfront.toFixed(2)},${hourly.toFixed(6)},${daily.toFixed(6)},${effectiveHourly.toFixed(6)},${effectiveDaily.toFixed(6)},${sku}`);
        }
      }
    }

    const pricingDir = join(__dirname, '../../../src/assets/pricing');
    mkdirSync(pricingDir, { recursive: true });
    const fileName = key.replace(/\//g, '_') + '.csv';
    const filePath = join(pricingDir, fileName);
    writeFileSync(filePath, csvLines.join('\n'));
    console.log(`Pricing CSV written to ${filePath}`);

    return { records: csvLines.length - 1, filePath };

  } catch (error) {
    console.error(`Error generating pricing for ${key}:`, error);
    return { records: 0, filePath: '' };
  }
}

function parseCloudabilityCSV(csvFile: string): Set<string> {
  const csvPath = join(__dirname, '../../../src/assets', csvFile);
  const csvContent = readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const uniqueKeys = new Set<string>();

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple CSV parser, assuming no escaped commas in fields
    const fields = parseCSVLine(line);
    if (fields.length < 8) continue; // Ensure enough fields

    const region = fields[5]; // Region
    const multiAZ = fields[6].toLowerCase() === 'true'; // multiAZ
    const product = fields[7].replace(/"/g, '').replace(/\s+/g, '').replace(/[()]/g, '-').replace(/-+$/g, ''); // Product, remove quotes and spaces, replace () with -, remove trailing -
    const instanceType = fields[4]; // Instance Type

    const deployment = multiAZ ? 'multi-az' : 'single-az';
    const instanceFamily = instanceType.startsWith('db.') ? instanceType.split('.')[1][0] : instanceType[0]; // First char of family

    const key = `${region}/${product}/${deployment}/${instanceFamily}`;
    uniqueKeys.add(key);
  }

  return uniqueKeys;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current); // Last field

  return fields;
}