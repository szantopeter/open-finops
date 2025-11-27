#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

function getAllJsonFiles(dirPath: string): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllJsonFiles(fullPath));
    } else if (item.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

function validatePricingFile(filePath: string): string[] {
  const errors: string[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    if (data.savingsOptions) {
      const optionsToCheck = ['1yr_All Upfront', '3yr_All Upfront'];
      for (const option of optionsToCheck) {
        if (data.savingsOptions[option]) {
          const opt = data.savingsOptions[option];
          if (opt.hourly !== 0) {
            errors.push(`${option} hourly is ${opt.hourly}, should be 0`);
          }
          if (opt.daily !== 0) {
            errors.push(`${option} daily is ${opt.daily}, should be 0`);
          }
        }
      }
      // Check that all savings options have required fields
      const requiredFields = ['term', 'purchaseOption', 'upfront', 'hourly', 'daily', 'adjustedAmortisedHourly', 'adjustedAmortisedDaily'];
      for (const [optionKey, optionData] of Object.entries(data.savingsOptions)) {
        if (typeof optionData === 'object' && optionData !== null) {
          for (const field of requiredFields) {
            if (!(field in optionData)) {
              errors.push(`${optionKey} is missing required field: ${field}`);
            }
          }
        } else {
          errors.push(`${optionKey} is not a valid object`);
        }
      }
    }
  } catch (e) {
    errors.push(`Failed to parse JSON - ${(e as Error).message}`);
  }
  return errors;
}

// Compute savings scenarios for a parsed pricing file object
function computeSavingsForData(data: any, filePath: string) {
  const results: Array<{ file: string; option: string; years: number; onDemandCost: number; reservedCost: number; saving: number; savingPct: number }> = [];
  try {
    if (!data || !data.onDemand) return results;
    const onDemandDaily = Number(data.onDemand.daily);
    if (!onDemandDaily || !data.savingsOptions) return results;

    for (const [optionKey, optionData] of Object.entries<any>(data.savingsOptions)) {
      if (!optionData || typeof optionData !== 'object') continue;
      // Determine term in years. optionData.term may be like '3yr' or numeric
      let years = 0;
      if (optionData.term && typeof optionData.term === 'string') {
        const m = optionData.term.match(/(\d+)\s*yr/i);
        if (m) years = Number(m[1]);
      }
      if (!years && typeof optionData.term === 'number') years = Number(optionData.term);
      if (!years) {
        const m2 = optionKey.match(/(\d+)/);
        if (m2) years = Number(m2[1]);
      }
      if (!years) continue; // cannot calculate without years

      const adjDaily = optionData.adjustedAmortisedDaily !== undefined ? Number(optionData.adjustedAmortisedDaily) : (optionData.effectiveDaily !== undefined ? Number(optionData.effectiveDaily) : NaN);
      if (Number.isNaN(adjDaily)) continue;

      const multiplier = years * 326.25; // per user's formula
      const onDemandCost = multiplier * onDemandDaily;
      const reservedCost = multiplier * adjDaily;
      const saving = onDemandCost - reservedCost;
      const savingPct = onDemandCost > 0 ? (saving / onDemandCost) * 100 : 0;

      results.push({ file: filePath, option: optionKey, years, onDemandCost, reservedCost, saving, savingPct });
    }
  } catch (err) {
    // ignore and return whatever collected
  }
  return results;
}

// Validate that savings percentages increase in the expected order
function validateSavingsOrder(savings: Array<{ option: string; savingPct: number }>) {
  const errors: string[] = [];
  const order = ['1yr_No Upfront', '1yr_Partial Upfront', '1yr_All Upfront', '3yr_Partial Upfront', '3yr_All Upfront'];
  const map: Record<string, number> = {};
  for (const s of savings) map[s.option] = Number(s.savingPct);

  // Check presence
  for (const opt of order) {
    if (!(opt in map)) {
      errors.push(`missing savings option: ${opt}`);
    }
  }

  // If any required option missing, return those errors (ordering can't be validated)
  if (errors.length > 0) return errors;

  // Validate strict increasing order
  for (let i = 0; i < order.length - 1; i++) {
    const a = map[order[i]];
    const b = map[order[i + 1]];
    if (!(a < b)) {
      errors.push(`ordering failed: ${order[i]} (${a.toFixed(2)}%) >= ${order[i + 1]} (${b.toFixed(2)}%)`);
    }
  }
  return errors;
}

function main() {
  const pricingDir = path.resolve(__dirname, '../../../src/assets/pricing');
  console.log(`Checking pricing files in ${pricingDir}`);
  const jsonFiles = getAllJsonFiles(pricingDir);
  console.log(`Found ${jsonFiles.length} JSON files to validate`);
  const errorsByFile: Map<string, string[]> = new Map();
  for (const file of jsonFiles) {
    const errors = validatePricingFile(file);
    if (errors.length > 0) {
      errorsByFile.set(file, errors);
    }
  }
  if (errorsByFile.size === 0) {
    console.log('All validations passed!');
    // Still compute and print savings summary
    const allSavings: Array<{ file: string; option: string; years: number; onDemandCost: number; reservedCost: number; saving: number; savingPct: number }> = [];
    for (const file of jsonFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const data = JSON.parse(content);
        const res = computeSavingsForData(data, path.basename(file));
        allSavings.push(...res);
      } catch (e) {
        // ignore parse errors here
      }
    }
    // Validate ordering per file, but only report a compact summary and details for failures
    const orderingErrorsByFile: Map<string, string[]> = new Map();
    let checkedFiles = 0;
    for (const file of jsonFiles) {
      const baseName = path.basename(file);
      if (baseName === 'metadata.json') continue; // skip non-pricing metadata files
      try {
        const content = fs.readFileSync(file, 'utf8');
        const data = JSON.parse(content);
        const res = computeSavingsForData(data, path.basename(file));
        // if there are no savings scenarios, skip counting this file
        if (!res || res.length === 0) continue;
        checkedFiles++;
        // group by file -> option,savingPct
        const grouped: Array<{ option: string; savingPct: number }> = [];
        for (const r of res) grouped.push({ option: r.option, savingPct: r.savingPct });
        const errs = validateSavingsOrder(grouped);
        if (errs.length > 0) orderingErrorsByFile.set(path.basename(file), errs);
      } catch (e) {
        // ignore
      }
    }

    const failed = orderingErrorsByFile.size;
    const ok = Math.max(0, checkedFiles - failed);
    console.log(`\nSavings ordering: ${ok} OK, ${failed} not OK (checked ${checkedFiles} files)`);
    if (failed > 0) {
      console.error('\nDetails for files that failed ordering:');
      for (const [f, errs] of orderingErrorsByFile) {
        console.error(`- ${f}`);
        for (const e of errs) console.error(`  - ${e}`);
      }
    }
    process.exit(0);
  } else {
    console.error(`Found validation errors in ${errorsByFile.size} files:`);
    for (const [filePath, errors] of errorsByFile) {
      const fileName = path.basename(filePath);
      console.error(`- ${fileName}`);
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Do you want to fix these errors? (y/N): ', (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        let fixedCount = 0;
        for (const [filePath, errors] of errorsByFile) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            if (data.savingsOptions) {
              const optionsToCheck = ['1yr_All Upfront', '3yr_All Upfront'];
              for (const option of optionsToCheck) {
                if (data.savingsOptions[option]) {
                  data.savingsOptions[option].hourly = 0;
                  data.savingsOptions[option].daily = 0;
                }
              }
            }
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            fixedCount++;
          } catch (e) {
            console.error(`Failed to fix ${path.basename(filePath)}: ${(e as Error).message}`);
          }
        }
        console.log(`Fixed ${fixedCount} files.`);
      } else {
        console.log('No fixes applied.');
      }
      rl.close();
      // After potential fixes, compute and print savings summary as well
      const allSavings: Array<{ file: string; option: string; years: number; onDemandCost: number; reservedCost: number; saving: number; savingPct: number }> = [];
      for (const file of jsonFiles) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const data = JSON.parse(content);
          const res = computeSavingsForData(data, path.basename(file));
          allSavings.push(...res);
        } catch (e) {
          // ignore
        }
      }
      if (allSavings.length > 0) {
        console.log('\nSavings Summary:');
        let totalOnDemand = 0;
        let totalReserved = 0;
        for (const s of allSavings) {
          console.log(`- ${s.file} / ${s.option}: ${s.years}yr — onDemand=${s.onDemandCost.toFixed(2)}, reserved=${s.reservedCost.toFixed(2)}, saving=${s.saving.toFixed(2)} (${s.savingPct.toFixed(2)}%)`);
          totalOnDemand += s.onDemandCost;
          totalReserved += s.reservedCost;
        }
        const totalSaving = totalOnDemand - totalReserved;
        const totalPct = totalOnDemand > 0 ? (totalSaving / totalOnDemand) * 100 : 0;
        console.log(`\nTotal onDemand: ${totalOnDemand.toFixed(2)}, totalReserved: ${totalReserved.toFixed(2)}, totalSaving: ${totalSaving.toFixed(2)} (${totalPct.toFixed(2)}%)`);
      } else {
        console.log('No savings scenarios found in pricing files.');
      }
      process.exit(0);
    });
  }
}

main();