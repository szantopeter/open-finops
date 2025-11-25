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
  string: ['regions', 'instances', 'out', 'service', 'profile', 'discountpercent'],
  // NOTE: --out is now interpreted as an output directory for the new folder-based layout
  // Default output directory will be the project's `src/assets/pricing` so generated files
  // are available under the application's static assets at /assets/pricing
  default: { out: '../../src/assets/pricing', service: 'AmazonRDS', discountpercent: '14' },
  boolean: ['all-instances']
});

const regions = (argv.regions || 'us-east-1').split(',').map(s=>s.trim()).filter(Boolean);
const instances = argv['all-instances'] ? null : (argv.instances || 'db.t3.medium').split(',').map(s=>s.trim()).filter(Boolean);
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

(async function main() {
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

      // Collect RI terms by deployment and per-variant on-demand records
      const riByDeployment = { 'Single-AZ': {}, 'Multi-AZ': {} };
      const perVariant = [];

      // For each product, attempt to extract on-demand hourly and record per-variant data
      for (const p of products) {
        const attrs = (p && p.product && p.product.attributes) || {};
        const deploymentRaw = attrs.deploymentOption || attrs.deployment || '';
        const deployment = normalizeDeployment(deploymentRaw) || 'Single-AZ';
        const engine = normalizeEngine(attrs.databaseEngine || attrs.servicecode || attrs.productFamily || '');
        const license = normalizeLicense(attrs.licenseModel || attrs.license || '');
        const edition = (attrs.databaseEdition || attrs.databaseEdition || '') || '';
        // Extract on-demand hourly for this specific product
        const hourly = extractOnDemandHourlyFromProduct(p);
        if (hourly) {
          const hourlyDisc = typeof hourly === 'number' ? Number((hourly * discountFactor).toFixed(6)) : hourly;
          const daily = typeof hourly === 'number' ? Number((hourly * 24 * discountFactor).toFixed(6)) : null;
          const sku = (p && p.product && p.product.sku) || null;

          const engineKey = buildEngineKey(engine, license, edition);
          perVariant.push({ deployment, engineKey, license, edition, hourly: hourlyDisc, daily, sku });
        }

        // Collect RI terms for this product under its deployment
        const rterms = extractReservedInstancePricing(p);
        if (rterms) {
          const target = riByDeployment[deployment] || riByDeployment['Single-AZ'];
          for (const k of Object.keys(rterms)) {
            // Skip 3-year No Upfront reserved offerings — do not expose them as savings options
            if (k === '3yr_No Upfront') continue;
            if (!target[k]) target[k] = rterms[k];
          }
        }
      }
      // Build discounted RI map per deployment (apply discountFactor to numeric fields)
      const discountedRiByDeployment = {};
      const expectedKeys = [
        '1yr_No Upfront', '1yr_Partial Upfront', '1yr_All Upfront',
        '3yr_Partial Upfront', '3yr_All Upfront'
      ];
      for (const dep of Object.keys(riByDeployment)) {
        const merged = riByDeployment[dep] || {};
        const discounted = {};
        for (const k of Object.keys(merged)) {
          const v = merged[k];
          const copy = Object.assign({}, v);
          if (copy.upfront !== undefined) copy.upfront = Number((copy.upfront * discountFactor).toFixed(2));
          if (copy.hourly !== undefined) copy.hourly = Number((copy.hourly * discountFactor).toFixed(6));
          if (copy.daily !== undefined) copy.daily = Number((copy.daily * discountFactor).toFixed(6));
          if (copy.effectiveHourly !== undefined) copy.effectiveHourly = Number((copy.effectiveHourly * discountFactor).toFixed(6));
          if (copy.effectiveDaily !== undefined) copy.effectiveDaily = Number((copy.effectiveDaily * discountFactor).toFixed(6));
          discounted[k] = copy;
        }
        // Ensure all expected keys exist; fill missing with null to indicate absence
        for (const ek of expectedKeys) {
          if (!Object.prototype.hasOwnProperty.call(discounted, ek)) {
            discounted[ek] = null;
          }
        }
        discountedRiByDeployment[dep] = discounted;
      }

      // Write per-variant files (include on-demand and savingsOptions for all 6 permutations)
      let anyWritten = false;
      for (const rec of perVariant) {
        const filename = `${r}_${it}_${rec.deployment.toLowerCase()}-${rec.engineKey}.json`;
        const filePath = path.join(instanceDir, filename);
        const fileObj = {
          region: r,
          instance: it,
          deployment: rec.deployment.toLowerCase(),
          engine: rec.engineKey,
          license: rec.license,
          onDemand: {
            hourly: rec.hourly,
            daily: rec.daily,
            effectiveHourly: rec.hourly,
            effectiveDaily: rec.daily,
            sku: rec.sku
          },
          // savingsOptions: may be null if no RI terms found for that deployment
          savingsOptions: discountedRiByDeployment[rec.deployment] || null
        };

        // Validate that on-demand price > reserved prices
        let isValid = true;
        if (fileObj.onDemand.daily && fileObj.savingsOptions) {
          for (const [key, sav] of Object.entries(fileObj.savingsOptions)) {
            if (sav && typeof sav.effectiveDaily === 'number' && sav.effectiveDaily >= fileObj.onDemand.daily) {
              errors.push(`Invalid pricing for ${filename}: reserved ${key} effectiveDaily (${sav.effectiveDaily}) >= on-demand daily (${fileObj.onDemand.daily})`);
              isValid = false;
              break;
            }
          }
        }

        if (isValid) {
          try {
            fs.writeFileSync(filePath, JSON.stringify(fileObj, null, 2), 'utf8');
            anyWritten = true;
          } catch (e) {
            console.error('Failed to write per-variant file', filePath, e && e.message);
          }
        } else {
          console.error(`Skipping invalid file: ${filename}`);
        }
      }

      // Ensure a broad set of engine variants exist even when not discovered in perVariant.
      // This creates fallback files (using on-demand hourly as source) for common engines and license variants
      // so the frontend can find a reasonable pricing file without failing.
      const enginesToEnsure = [
        'aurora-postgresql', 'aurora-mysql', 'mysql', 'postgresql', 'mariadb',
        'oracle-se2', 'oracle-ee', 'oracle-se2-byol', 'oracle-ee-byol',
        'db2', 'db2-se', 'db2-byol',
        'sqlserver-web-li', 'sqlserver-ex-li'
      ];

      const deploymentsToEnsure = ['Single-AZ', 'Multi-AZ'];

      for (const eng of enginesToEnsure) {
        for (const dep of deploymentsToEnsure) {
          const wantedFilename = `${r}_${it}_${dep.toLowerCase()}-${eng}.json`;
          const wantedPath = path.join(instanceDir, wantedFilename);
          if (!fs.existsSync(wantedPath)) {
            try {
              const od = await getOnDemandHourly(it, r);
              if (od && od.hourly) {
                const hourlyDisc = typeof od.hourly === 'number' ? Number((od.hourly * discountFactor).toFixed(6)) : od.hourly;
                const daily = typeof hourlyDisc === 'number' ? Number((hourlyDisc * 24).toFixed(6)) : null;
                const fileObj = {
                  region: r,
                  instance: it,
                  deployment: dep.toLowerCase(),
                  engine: eng,
                  license: null,
                  onDemand: { hourly: hourlyDisc, daily: daily, effectiveHourly: hourlyDisc, effectiveDaily: daily, sku: od.product && od.product.product && od.product.product.sku ? od.product.product.sku : null },
                  savingsOptions: discountedRiByDeployment[dep] || null
                };

                // Validate ensured files too
                let isValid = true;
                if (fileObj.onDemand.daily && fileObj.savingsOptions) {
                  for (const [key, sav] of Object.entries(fileObj.savingsOptions)) {
                    if (sav && typeof sav.effectiveDaily === 'number' && sav.effectiveDaily >= fileObj.onDemand.daily) {
                      errors.push(`Invalid pricing for ensured ${wantedFilename}: reserved ${key} effectiveDaily (${sav.effectiveDaily}) >= on-demand daily (${fileObj.onDemand.daily})`);
                      isValid = false;
                      break;
                    }
                  }
                }

                if (isValid) {
                  fs.writeFileSync(wantedPath, JSON.stringify(fileObj, null, 2), 'utf8');
                  anyWritten = true;
                } else {
                  console.error(`Skipping invalid ensured file: ${wantedFilename}`);
                }
              }
            } catch (e) {
              console.error('Failed to write ensured engine file', wantedPath, e && e.message);
            }
          }
          // Also write a capitalized variant (some existing files use mixed-case engine keys like 'Db2')
          const engCap = eng.charAt(0).toUpperCase() + eng.slice(1);
          const wantedFilenameCap = `${r}_${it}_${dep.toLowerCase()}-${engCap}.json`;
          const wantedPathCap = path.join(instanceDir, wantedFilenameCap);
          if (!fs.existsSync(wantedPathCap)) {
            try {
              const od = await getOnDemandHourly(it, r);
              if (od && od.hourly) {
                const hourlyDisc = typeof od.hourly === 'number' ? Number((od.hourly * discountFactor).toFixed(6)) : od.hourly;
                const daily = typeof hourlyDisc === 'number' ? Number((hourlyDisc * 24).toFixed(6)) : null;
                const fileObj = {
                  region: r,
                  instance: it,
                  deployment: dep.toLowerCase(),
                  engine: engCap,
                  license: null,
                  onDemand: { hourly: hourlyDisc, daily: daily, effectiveHourly: hourlyDisc, effectiveDaily: daily, sku: od.product && od.product.product && od.product.product.sku ? od.product.product.sku : null },
                  savingsOptions: discountedRiByDeployment[dep] || null
                };

                // Validate capitalized variant files too
                let isValid = true;
                if (fileObj.onDemand.daily && fileObj.savingsOptions) {
                  for (const [key, sav] of Object.entries(fileObj.savingsOptions)) {
                    if (sav && typeof sav.effectiveDaily === 'number' && sav.effectiveDaily >= fileObj.onDemand.daily) {
                      errors.push(`Invalid pricing for ensured capitalized ${wantedFilenameCap}: reserved ${key} effectiveDaily (${sav.effectiveDaily}) >= on-demand daily (${fileObj.onDemand.daily})`);
                      isValid = false;
                      break;
                    }
                  }
                }

                if (isValid) {
                  fs.writeFileSync(wantedPathCap, JSON.stringify(fileObj, null, 2), 'utf8');
                  anyWritten = true;
                } else {
                  console.error(`Skipping invalid ensured capitalized file: ${wantedFilenameCap}`);
                }
              }
            } catch (e) {
              console.error('Failed to write ensured engine file (cap variant)', wantedPathCap, e && e.message);
            }
          }
        }
      }

      // Also ensure a base engine file (no edition/license suffix) exists for common engines
      const baseEngines = ['oracle', 'mysql', 'postgresql', 'aurora-postgresql', 'aurora-mysql', 'db2', 'mariadb', 'sqlserver'];
      for (const baseEng of baseEngines) {
        for (const dep of deploymentsToEnsure) {
          const baseFilename = `${r}_${it}_${dep.toLowerCase()}-${baseEng}.json`;
          const basePath = path.join(instanceDir, baseFilename);
          if (!fs.existsSync(basePath)) {
            try {
              const od = await getOnDemandHourly(it, r);
              if (od && od.hourly) {
                const hourlyDisc = typeof od.hourly === 'number' ? Number((od.hourly * discountFactor).toFixed(6)) : od.hourly;
                const daily = typeof hourlyDisc === 'number' ? Number((hourlyDisc * 24).toFixed(6)) : null;
                const fileObj = {
                  region: r,
                  instance: it,
                  deployment: dep.toLowerCase(),
                  engine: baseEng,
                  license: null,
                  onDemand: { hourly: hourlyDisc, daily: daily, effectiveHourly: hourlyDisc, effectiveDaily: daily, sku: od.product && od.product.product && od.product.product.sku ? od.product.product.sku : null },
                  savingsOptions: discountedRiByDeployment[dep] || null
                };

                // Validate base engine files too
                let isValid = true;
                if (fileObj.onDemand.daily && fileObj.savingsOptions) {
                  for (const [key, sav] of Object.entries(fileObj.savingsOptions)) {
                    if (sav && typeof sav.effectiveDaily === 'number' && sav.effectiveDaily >= fileObj.onDemand.daily) {
                      errors.push(`Invalid pricing for base engine ${baseFilename}: reserved ${key} effectiveDaily (${sav.effectiveDaily}) >= on-demand daily (${fileObj.onDemand.daily})`);
                      isValid = false;
                      break;
                    }
                  }
                }

                if (isValid) {
                  fs.writeFileSync(basePath, JSON.stringify(fileObj, null, 2), 'utf8');
                  anyWritten = true;
                } else {
                  console.error(`Skipping invalid base engine file: ${baseFilename}`);
                }
              }
            } catch (e) {
              console.error('Failed to write base engine file', basePath, e && e.message);
            }
          }
        }
      }

      // Also ensure a base engine file (no edition/license suffix) exists for common engines
      for (const baseEng of baseEngines) {
        for (const dep of deploymentsToEnsure) {
          const baseFilename = `${r}_${it}_${dep.toLowerCase()}-${baseEng}.json`;
          const basePath = path.join(instanceDir, baseFilename);
          if (!fs.existsSync(basePath)) {
            try {
              const od = await getOnDemandHourly(it, r);
              if (od && od.hourly) {
                const hourlyDisc = typeof od.hourly === 'number' ? Number((od.hourly * discountFactor).toFixed(6)) : od.hourly;
                const daily = typeof hourlyDisc === 'number' ? Number((hourlyDisc * 24).toFixed(6)) : null;
                const fileObj = {
                  region: r,
                  instance: it,
                  deployment: dep,
                  engine: baseEng,
                  license: null,
                  onDemand: { hourly: hourlyDisc, daily: daily, effectiveHourly: hourlyDisc, effectiveDaily: daily, sku: od.product && od.product.product && od.product.product.sku ? od.product.product.sku : null },
                  savingsOptions: discountedRiByDeployment[dep] || null
                };

                // Validate base engine files too
                let isValid = true;
                if (fileObj.onDemand.daily && fileObj.savingsOptions) {
                  for (const [key, sav] of Object.entries(fileObj.savingsOptions)) {
                    if (sav && typeof sav.effectiveDaily === 'number' && sav.effectiveDaily >= fileObj.onDemand.daily) {
                      errors.push(`Invalid pricing for base engine ${baseFilename}: reserved ${key} effectiveDaily (${sav.effectiveDaily}) >= on-demand daily (${fileObj.onDemand.daily})`);
                      isValid = false;
                      break;
                    }
                  }
                }

                if (isValid) {
                  fs.writeFileSync(basePath, JSON.stringify(fileObj, null, 2), 'utf8');
                  anyWritten = true;
                } else {
                  console.error(`Skipping invalid base engine file: ${baseFilename}`);
                }
              }
            } catch (e) {
              console.error('Failed to write base engine file', basePath, e && e.message);
            }
          }
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
    console.error(`\nValidation Errors Summary (${errors.length} files skipped):`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
  } else {
    console.log('\nNo validation errors - all files generated successfully.');
  }
})();
