#!/usr/bin/env node
/*
 Minimal Node.js script to generate AWS RDS pricing data by querying AWS Pricing GetProducts.
 Usage:
   node generate-pricing.js --regions=us-east-1,eu-west-1 --instances=db.t3.medium,db.r5b.2xlarge --out=../src/pricing/aws-rds-pricing-data.json

 AWS credentials must be available in the environment/profile where this script runs.
*/
const fs = require('fs');
const path = require('path');
const { PricingClient, GetProductsCommand } = require('@aws-sdk/client-pricing');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['regions', 'instances', 'out', 'service', 'profile', 'discountpercent', 'csv'],
  // NOTE: --out is now interpreted as an output directory for the new folder-based layout
  // Default output directory will be the project's `src/assets/pricing` so generated files
  // are available under the application's static assets at /assets/pricing
  default: { out: '../../src/assets/pricing', service: 'AmazonRDS', discountpercent: '0' },
  boolean: ['all-instances']
});

const regions = (argv.regions || 'us-east-1').split(',').map(s=>s.trim()).filter(Boolean);
let instances = argv['all-instances'] ? null : (argv.instances || 'db.t3.medium').split(',').map(s=>s.trim()).filter(Boolean);
// Determine output path. If relative, resolve it relative to this script's directory so
// running the generator from different CWDs doesn't write into tools/ by accident.
const outPathRaw = argv.out || '../../src/assets/pricing';
let outPath = outPathRaw;
if (!path.isAbsolute(outPath)) {
  outPath = path.resolve(__dirname, outPathRaw);
}
// If user passed a .json file path explicitly, keep legacy single-file behavior
const wantsSingleFile = String(outPath).toLowerCase().endsWith('.json');
const outDir = wantsSingleFile ? path.dirname(outPath) : outPath;
const service = argv.service || 'AmazonRDS';
// Discount percentage to apply to prices (e.g., 14 => 14% off)
// Accept multiple common spellings for backwards compatibility: --discountpercent, --discountPercent, --discount
const discountPercent = Number(argv.discountpercent || argv.discountPercent || argv.discount || '14');
const discountFactor = (Number.isFinite(discountPercent) ? (1 - (discountPercent / 100)) : 1);

// If profile is provided via command line, use it; otherwise use AWS_PROFILE env or first profile from config
if (argv.profile && !process.env.AWS_PROFILE) {
  process.env.AWS_PROFILE = argv.profile;
}

const regionNameMap = require('./region-mapping.json');

const client = new PricingClient({ region: 'us-east-1' });

function extractOnDemandHourlyFromProduct(product) {
  try {
    const terms = product.terms && product.terms.OnDemand;
    if (!terms) return null;
    for (const tk of Object.keys(terms)) {
      const term = terms[tk];
      const pds = term.priceDimensions || {};
      for (const pdKey of Object.keys(pds)) {
        const pd = pds[pdKey];
        const price = pd.pricePerUnit && (pd.pricePerUnit.USD || pd.pricePerUnit);
        const v = Number.parseFloat(price);
        if (!Number.isNaN(v) && v > 0) return v;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function extractReservedInstancePricing(product) {
  try {
    const reserved = product.terms && product.terms.Reserved;
    if (!reserved) return null;
    
    const pricing = {};
    for (const tk of Object.keys(reserved)) {
      const term = reserved[tk];
      const attrs = term.termAttributes || {};
      const leaseContractLength = attrs.LeaseContractLength;
      const purchaseOption = attrs.PurchaseOption;
      
      if (!leaseContractLength || !purchaseOption) continue;
      
      // Extract upfront and hourly pricing
      let upfront = 0;
      let hourly = 0;
      const pds = term.priceDimensions || {};
      
      for (const pdKey of Object.keys(pds)) {
        const pd = pds[pdKey];
        const unit = pd.unit;
        const pricePerUnit = pd.pricePerUnit && (pd.pricePerUnit.USD || pd.pricePerUnit);
        const price = Number.parseFloat(pricePerUnit);
        
        if (Number.isNaN(price)) continue;
        
        if (unit === 'Quantity') {
          upfront = price;
        } else if (unit === 'Hrs') {
          hourly = price;
        }
      }
      
      // Calculate effective hourly rate
      const termYears = leaseContractLength === '1yr' ? 1 : 3;
      const totalHours = termYears * 365.25 * 24;
      const effectiveHourly = (upfront / totalHours) + hourly;
      
      const key = `${leaseContractLength}_${purchaseOption}`;
      // Compute raw daily price (hourly * 24)
      const daily = Number((hourly * 24).toFixed(6));
      // Compute effective daily price (effective hourly * 24)
      const effectiveDaily = Number((effectiveHourly * 24).toFixed(6));
      pricing[key] = {
        term: leaseContractLength,
        purchaseOption: purchaseOption,
        upfront: Number(upfront.toFixed(2)),
        hourly: Number(hourly.toFixed(6)),
        daily: daily,
        effectiveHourly: Number(effectiveHourly.toFixed(6)),
        effectiveDaily: effectiveDaily
      };
    }
    
    return Object.keys(pricing).length > 0 ? pricing : null;
  } catch (e) {
    return null;
  }
}

const { spawnSync } = require('child_process');

function cliFiltersArg(filters) {
  // Convert [{Type,Field,Value}, ...] to CLI style: Name=instanceType,Value=db.t3.medium,Type=TERM_MATCH
  return filters.map(f => `Type=${f.Type},Field=${f.Field},Value=${f.Value}`);
}

async function getProductsForFilters(filters, maxResults = 100) {
  const params = { ServiceCode: service, Filters: filters, FormatVersion: 'aws_v1', MaxResults: maxResults };
  try {
    const cmd = new GetProductsCommand(params);
    const resp = await client.send(cmd);
    
    // Save full API response to logs
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filterSummary = filters.map(f => `${f.Field}=${f.Value}`).join('_').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `logs/getProductsForFilters_${filterSummary}_${timestamp}.json`;
    
    // Create a copy of the response with parsed PriceList
    const responseForLog = {
      ...resp,
      PriceList: resp.PriceList ? resp.PriceList.map(p => JSON.parse(p)) : []
    };
    
    fs.writeFileSync(filename, JSON.stringify({
      apiCall: 'getProductsForFilters',
      parameters: params,
      timestamp: new Date().toISOString(),
      response: responseForLog
    }, null, 2), 'utf8');
    
    return resp.PriceList ? resp.PriceList.map(p => JSON.parse(p)) : [];
  } catch (err) {
    const msg = err && (err.message || err.name) ? (err.message || err.name) : String(err);
    console.error('getProducts error', msg);
    if (msg.includes('unable to get local issuer certificate') || msg.includes('self signed certificate')) {
      console.error('TLS error detected in Node AWS SDK. Attempting AWS CLI fallback (uses Python requests and may accept your corporate CA).');

      // Try AWS CLI fallback using same filters
      try {
        const cliArgs = ['pricing', 'get-products', '--service-code', service, '--filters', ...cliFiltersArg(filters), '--format-version', 'aws_v1', '--output', 'json', '--region', 'us-east-1'];
        // If AWS_PROFILE is set in env, rely on it; otherwise do not pass profile.
        if (process.env.AWS_PROFILE) {
          cliArgs.push('--profile', process.env.AWS_PROFILE);
        }
        // If NODE_EXTRA_CA_CERTS or SSL_CERT_FILE are set, map to AWS_CA_BUNDLE for CLI
        const env = Object.assign({}, process.env);
        if (env.NODE_EXTRA_CA_CERTS && !env.AWS_CA_BUNDLE) env.AWS_CA_BUNDLE = env.NODE_EXTRA_CA_CERTS;
        if (env.SSL_CERT_FILE && !env.AWS_CA_BUNDLE) env.AWS_CA_BUNDLE = env.SSL_CERT_FILE;

        console.error('Running aws', cliArgs.join(' '));
        const out = spawnSync('aws', cliArgs, { env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        if (out.error) throw out.error;
        if (out.status !== 0) {
          console.error('AWS CLI fallback failed:', out.stderr || out.stdout);
          return [];
        }
        const parsed = JSON.parse(out.stdout || out.stdout);
        // CLI returns a PriceList in parsed.PriceList possibly as strings
        
        // Save CLI API response to logs
        const cliTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const cliFilename = `logs/cliFallback_getProducts_${filterSummary}_${cliTimestamp}.json`;
        
        // Create a copy of the parsed response with parsed PriceList
        const cliResponseForLog = {
          ...parsed,
          PriceList: parsed.PriceList ? parsed.PriceList.map(p => typeof p === 'string' ? JSON.parse(p) : p) : []
        };
        
        fs.writeFileSync(cliFilename, JSON.stringify({
          apiCall: 'cliFallback_getProducts',
          parameters: { cliArgs, service, filters },
          timestamp: new Date().toISOString(),
          response: cliResponseForLog
        }, null, 2), 'utf8');
        
        if (Array.isArray(parsed.PriceList)) {
          return parsed.PriceList.map(p => typeof p === 'string' ? JSON.parse(p) : p);
        }
        return [];
      } catch (cliErr) {
        console.error('AWS CLI fallback failed with', cliErr && (cliErr.message || cliErr.name) ? (cliErr.message || cliErr.name) : String(cliErr));
        return [];
      }
    }
    if (msg.includes('not authorized to perform') || msg.includes('AccessDenied') || msg.includes('pricing:GetProducts')) {
      console.error('\nAuthorization error: the AWS identity you used does not have permission to call pricing:GetProducts.');
      console.error('Common fixes:');
      console.error(' - Run the generator with an AWS profile that has the PricingServiceFullAccess or equivalent policy.');
      console.error(' - Ask your AWS administrator to attach a policy allowing "pricing:GetProducts" to the role or user used by your SSO profile.');
      console.error(' - Alternatively, generate the pricing_map.json on a machine/account that has access and copy it into src/pricing/pricing_map.json.');
      // Exit early since further attempts will likely fail with the same permission error
      process.exit(7);
    }
    return [];
  }
}

async function getOnDemandHourly(instanceType, regionCode) {
  const location = regionNameMap[regionCode] || regionCode;
  const filters = [
    { Type: 'TERM_MATCH', Field: 'instanceType', Value: instanceType },
    { Type: 'TERM_MATCH', Field: 'location', Value: location }
  ];

  // productFamily filter may differ; we try both Database Instance and Compute Instance
  let products = await getProductsForFilters(filters.concat({ Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Database Instance' }));
  if (!products || products.length === 0) {
    products = await getProductsForFilters(filters.concat({ Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Compute Instance' }));
  }

  for (const p of products) {
    const hourly = extractOnDemandHourlyFromProduct(p);
    if (hourly) return { hourly, product: p };
  }
  return null;
}

// Return all matching pricing products for an instance/region so callers can inspect Reserved terms
async function getProductsForInstance(instanceType, regionCode) {
  const location = regionNameMap[regionCode] || regionCode;
  const baseFilters = [
    { Type: 'TERM_MATCH', Field: 'instanceType', Value: instanceType },
    { Type: 'TERM_MATCH', Field: 'location', Value: location }
  ];

  let products = await getProductsForFilters(baseFilters.concat({ Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Database Instance' }));
  if (!products || products.length === 0) {
    products = await getProductsForFilters(baseFilters.concat({ Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Compute Instance' }));
  }
  return products || [];
}

async function getAllInstanceTypes(regionCode) {
  const location = regionNameMap[regionCode] || regionCode;
  const filters = [
    { Type: 'TERM_MATCH', Field: 'location', Value: location },
    { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Database Instance' }
  ];

  console.error(`Discovering all instance types for ${regionCode}...`);
  
  const instanceTypes = new Set();
  let nextToken = null;
  let pageCount = 0;
  
  do {
    const params = { 
      ServiceCode: service, 
      Filters: filters, 
      FormatVersion: 'aws_v1', 
      MaxResults: 100 
    };
    if (nextToken) params.NextToken = nextToken;
    
    try {
      const cmd = new GetProductsCommand(params);
      const resp = await client.send(cmd);
      
      // Save full API response to logs
      const pageTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const pageFilename = `logs/getAllInstanceTypes_${regionCode}_page${pageCount}_${pageTimestamp}.json`;
      
      // Create a copy of the response with parsed PriceList
      const pageResponseForLog = {
        ...resp,
        PriceList: resp.PriceList ? resp.PriceList.map(p => JSON.parse(p)) : []
      };
      
      fs.writeFileSync(pageFilename, JSON.stringify({
        apiCall: 'getAllInstanceTypes',
        parameters: params,
        regionCode: regionCode,
        pageCount: pageCount,
        timestamp: new Date().toISOString(),
        response: pageResponseForLog
      }, null, 2), 'utf8');
      
      if (resp.PriceList) {
        for (const priceItem of resp.PriceList) {
          const p = JSON.parse(priceItem);
          const attrs = p.product?.attributes;
          if (attrs?.instanceType) {
            instanceTypes.add(attrs.instanceType);
          }
        }
      }
      
      nextToken = resp.NextToken;
      pageCount++;
      console.error(`  Page ${pageCount}: ${instanceTypes.size} unique types so far...`);
    } catch (err) {
      console.error('Error fetching instance types:', err.message);
      break;
    }
  } while (nextToken);
  
  const types = Array.from(instanceTypes).sort((a, b) => a.localeCompare(b));
  console.error(`Found ${types.length} instance types total`);
  return types;
}

// Helper: normalize deployment option into 'Single-AZ' or 'Multi-AZ'
function normalizeDeployment(deploymentOption) {
  const lower = (deploymentOption || '').toString().toLowerCase();
  if (lower.includes('multi')) return 'Multi-AZ';
  if (lower.includes('single')) return 'Single-AZ';
  return null;
}

// Helper: normalize database engine strings into canonical keys
function normalizeEngine(databaseEngine) {
  const lower = (databaseEngine || '').toString().toLowerCase();
  if (lower.includes('aurora') && lower.includes('mysql')) return 'aurora-mysql';
  if (lower.includes('aurora') && (lower.includes('postgres') || lower.includes('postgresql'))) return 'aurora-postgresql';
  if (lower.includes('mysql')) return 'mysql';
  if (lower.includes('postgres') || lower.includes('postgresql')) return 'postgresql';
  if (lower.includes('mariadb')) return 'mariadb';
  if (lower.includes('oracle')) return 'oracle';
  if (lower.includes('sql server') || lower.includes('sqlserver')) return 'sqlserver';
  return databaseEngine || null;
}

// Helper: normalize license model to 'byol' or 'li'
function normalizeLicense(licenseModel) {
  const lower = (licenseModel || '').toString().toLowerCase();
  if (lower.includes('bring') || lower.includes('byol')) return 'byol';
  if (lower.includes('license included') || lower.includes('included')) return 'li';
  return null;
}

// Helper: build engine key like 'oracle-se2-byol' or 'mysql-li'
function buildEngineKey(engine, license, edition) {
  if (!engine) return '';
  let key = engine;
  if (edition) {
    const ed = edition.toString().toLowerCase();
    if (ed.includes('enterprise') || ed.includes('ee')) key += '-ee';
    else if (ed.includes('standard') && ed.includes('two')) key += '-se2';
    else if (ed.includes('standard') || ed.includes('se')) key += '-se';
    else if (ed.includes('express') || ed.includes('ex')) key += '-ex';
    else if (ed.includes('web')) key += '-web';
  }
  if (license) key += `-${license}`;
  return key;
}

function parseCSVFromFile(csvPath) {
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  
  const header = parseCsvLine(lines[0]);
  const headers = header.map(h => h.trim());
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length === 0) continue;
    
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] ?? '';
    }
    rows.push(obj);
  }
  return rows;
}

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  result.push(cur);
  return result;
}

// Helper: parse product string to extract engine, edition, license
function parseProduct(product) {
  const lower = (product || '').toString().toLowerCase().trim();
  let engine = null;
  let edition = null;
  let license = null;

  // Handle Aurora engines
  if (lower.includes('aurora') && lower.includes('mysql')) {
    engine = 'aurora-mysql';
  } else if (lower.includes('aurora') && (lower.includes('postgres') || lower.includes('postgresql'))) {
    engine = 'aurora-postgresql';
  } else if (lower.includes('mysql')) {
    engine = 'mysql';
  } else if (lower.includes('postgres') || lower.includes('postgresql')) {
    engine = 'postgresql';
  } else if (lower.includes('mariadb')) {
    engine = 'mariadb';
  } else if (lower.includes('oracle')) {
    engine = 'oracle';
    // Extract edition and license for Oracle
    if (lower.includes('se2')) {
      edition = 'se2';
    } else if (lower.includes('ee')) {
      edition = 'ee';
    }
    if (lower.includes('byol') || lower.includes('(byol)')) {
      license = 'byol';
    } else if (lower.includes('li') || lower.includes('license included')) {
      license = 'li';
    }
  } else if (lower.includes('sql server') || lower.includes('sqlserver')) {
    engine = 'sqlserver';
  } else {
    // Fallback: use the whole string as engine after cleaning
    engine = lower.replace(/[()]/g, '').replace(/\s+/g, '-');
  }

  return { engine, edition, license };
}

(async function main() {
  // If --csv is provided, parse it and collect needed files
  let neededFiles = new Set();
  if (argv.csv) {
    console.error(`Parsing CSV file: ${argv.csv}`);
    const csvData = parseCSVFromFile(argv.csv);
    const regionsSet = new Set();
    const instancesSet = new Set();
    
    for (const row of csvData) {
      // Determine deployment and engine for file path
      const region = row['Region']?.trim();
      const instanceType = row['Instance Type']?.trim();
      const multiAZ = row['multiAZ']?.trim().toLowerCase() === 'true';
      const product = row['Product']?.trim();
      
      if (region && instanceType && product) {
        regionsSet.add(region);
        instancesSet.add(instanceType);
        const deployment = multiAZ ? 'multi-az' : 'single-az';
        const { engine, edition, license } = parseProduct(product);
        const engineKey = buildEngineKey(engine, license, edition);
        const filePath = `${region}/${instanceType}/${region}_${instanceType}_${deployment}-${engineKey}.json`;
        neededFiles.add(filePath);
        // Also add SE <-> SE2 variant to guard against CSV using 'SE' while AWS products use 'SE2' (or vice versa)
        try {
          if (engineKey && engineKey.includes('se2')) {
            const alt = engineKey.replace('se2', 'se');
            const altPath = `${region}/${instanceType}/${region}_${instanceType}_${deployment}-${alt}.json`;
            neededFiles.add(altPath);
          } else if (engineKey && /(^|-)se($|-)/.test(engineKey) && !engineKey.includes('se2')) {
            const alt = engineKey.replace(/(^|-)se($|-)/, (m) => m.replace('se', 'se2'));
            const altPath = `${region}/${instanceType}/${region}_${instanceType}_${deployment}-${alt}.json`;
            neededFiles.add(altPath);
          }
        } catch (e) {
          // non-fatal; best-effort alternate key generation
        }
      }
    }
    
    // Override regions and instances to only those in CSV
    regions.splice(0, regions.length, ...Array.from(regionsSet));
    instances = Array.from(instancesSet);
    
    console.error(`Found ${regions.length} regions and ${instances.length} instances in CSV`);
    console.log('Pricing files needed for the CSV:');
    const sortedFiles = Array.from(neededFiles).sort();
    for (const file of sortedFiles) {
      console.log(file);
    }
    console.log(`Will generate ${neededFiles.size} specific pricing files...`);
  }

  // Prepare metadata (minimal manifest)
  const metadata = { fetchedAt: new Date().toISOString(), source: service, discountPercentApplied: discountPercent };
  const summary = { currency: 'USD', regions: {} };
  const errors = []; // Collect validation errors
  
  for (const r of regions) {
    summary.regions[r] = { instanceClasses: {} };
    
    // Get instance types to process
    let instanceTypesToProcess;
    if (instances === null) {
      // Fetch all available instance types
      instanceTypesToProcess = await getAllInstanceTypes(r);
    } else {
      instanceTypesToProcess = instances;
    }
    
    console.error(`Processing ${instanceTypesToProcess.length} instance types for ${r}`);
    
    for (const it of instanceTypesToProcess) {
      process.stdout.write(`Fetching ${it} @ ${r} ... `);
      // Fetch all pricing products for this instance to allow creating per-variant files
      const products = await getProductsForInstance(it, r);

      if (!products || products.length === 0) {
        console.log('NOT FOUND');
        continue;
      }

      console.error(`Found ${products.length} raw products for ${it} @ ${r}`);

      // Prepare directories
      const path = require('path');
      const instanceDir = path.join(outDir, r, it);
      fs.mkdirSync(instanceDir, { recursive: true });

      // Collect RI terms and on-demand prices per product SKU
      const pricingBySku = {};

      // For each product, attempt to extract on-demand hourly and record per-variant data
      for (const p of products) {
        const sku = (p && p.product && p.product.sku) || null;
        if (!sku) continue;

        if (!pricingBySku[sku]) {
          const attrs = (p && p.product && p.product.attributes) || {};
          const deploymentRaw = attrs.deploymentOption || attrs.deployment || '';
          const deployment = normalizeDeployment(deploymentRaw) || 'Single-AZ';
          const engine = normalizeEngine(attrs.databaseEngine || attrs.servicecode || attrs.productFamily || '');
          const license = normalizeLicense(attrs.licenseModel || attrs.license || '');
          const edition = (attrs.databaseEdition || '') || '';
          const engineKey = buildEngineKey(engine, license, edition);
          
          pricingBySku[sku] = {
            deployment,
            engineKey,
            license,
            edition,
            onDemand: null,
            savingsOptions: null
          };
        }

        // Extract on-demand hourly for this specific product
        const hourly = extractOnDemandHourlyFromProduct(p);
        if (hourly) {
          const hourlyDisc = typeof hourly === 'number' ? Number((hourly * discountFactor).toFixed(6)) : hourly;
          const daily = typeof hourly === 'number' ? Number((hourly * 24 * discountFactor).toFixed(6)) : null;
          pricingBySku[sku].onDemand = {
            hourly: hourlyDisc,
            daily,
            effectiveHourly: hourlyDisc,
            effectiveDaily: daily,
            sku: sku
          };
        }

        // Collect RI terms for this product
        const rterms = extractReservedInstancePricing(p);
        if (rterms) {
            const discounted = {};
            for (const k of Object.keys(rterms)) {
                if (k === '3yr_No Upfront') continue;
                const v = rterms[k];
                const copy = Object.assign({}, v);
                if (copy.upfront !== undefined) copy.upfront = Number((copy.upfront * discountFactor).toFixed(2));
                if (copy.hourly !== undefined) copy.hourly = Number((copy.hourly * discountFactor).toFixed(6));
                if (copy.daily !== undefined) copy.daily = Number((copy.daily * discountFactor).toFixed(6));
                if (copy.effectiveHourly !== undefined) copy.effectiveHourly = Number((copy.effectiveHourly * discountFactor).toFixed(6));
                if (copy.effectiveDaily !== undefined) copy.effectiveDaily = Number((copy.effectiveDaily * discountFactor).toFixed(6));
                discounted[k] = copy;
            }
            pricingBySku[sku].savingsOptions = discounted;
        }
      }

      // Write per-variant files (include on-demand and savingsOptions for all 6 permutations)
      let anyWritten = false;
      for (const sku of Object.keys(pricingBySku)) {
        const rec = pricingBySku[sku];
        if (!rec.onDemand) continue; // Cannot create a file without on-demand price

        const filename = `${r}_${it}_${rec.deployment.toLowerCase()}-${rec.engineKey}.json`;
        const filePath = path.join(instanceDir, filename);
        const fullPath = `${r}/${it}/${filename}`;
        if (argv.csv && !neededFiles.has(fullPath)) continue; // Skip if not needed
        
        const fileObj = {
          region: r,
          instance: it,
          deployment: rec.deployment.toLowerCase(),
          engine: rec.engineKey,
          license: rec.license,
          onDemand: rec.onDemand,
          savingsOptions: rec.savingsOptions
        };

        // Validate that on-demand price > reserved prices
        if (fileObj.onDemand.daily && fileObj.savingsOptions) {
          for (const [key, sav] of Object.entries(fileObj.savingsOptions)) {
            if (sav && typeof sav.effectiveDaily === 'number' && sav.effectiveDaily >= fileObj.onDemand.daily) {
              errors.push(`Invalid pricing for ${filename}: reserved ${key} effectiveDaily (${sav.effectiveDaily}) >= on-demand daily (${fileObj.onDemand.daily})`);
              // Note: Not skipping invalid files, just logging
            }
          }
        }

        // Always write the file
        try {
          fs.writeFileSync(filePath, JSON.stringify(fileObj, null, 2), 'utf8');
          anyWritten = true;
        } catch (e) {
          console.error('Failed to write per-variant file', filePath, e && e.message);
        }
      }

      if (anyWritten) console.log('OK'); else console.log('NOT FOUND');
    }
  }
  // Write minimal metadata.json into outDir
  fs.mkdirSync(outDir, { recursive: true });
  const metaPath = require('path').join(outDir, 'metadata.json');
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log('Wrote metadata:', metaPath);

  // Display error summary
  if (errors.length > 0) {
    console.error(`\nValidation Errors Summary (${errors.length} files with validation warnings):`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
  } else {
    console.log('\nNo validation errors - all files generated successfully.');
  }
})();
