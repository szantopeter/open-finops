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
      const requiredFields = ['term', 'purchaseOption', 'upfront', 'hourly', 'daily', 'effectiveHourly', 'effectiveDaily'];
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
      process.exit(0);
    });
  }
}

main();