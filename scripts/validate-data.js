#!/usr/bin/env node

/**
 * Data validation script
 * Checks shops.json for data quality issues
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SHOPS_PATH = join(__dirname, '..', 'shops.json');

// USA coordinate bounds
const USA_BOUNDS = {
  minLat: 24.5,
  maxLat: 49.5,
  minLng: -125.0,
  maxLng: -66.5,
};

/**
 * Validation result collector
 */
class ValidationResults {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  addError(message, context = {}) {
    this.errors.push({ message, ...context });
  }

  addWarning(message, context = {}) {
    this.warnings.push({ message, ...context });
  }

  get hasErrors() {
    return this.errors.length > 0;
  }

  print() {
    if (this.errors.length > 0) {
      console.log('\n=== ERRORS ===\n');
      this.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err.message}`);
        if (err.shopId) console.log(`   Shop ID: ${err.shopId}`);
        if (err.shopName) console.log(`   Shop: ${err.shopName}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log('\n=== WARNINGS ===\n');
      this.warnings.forEach((warn, i) => {
        console.log(`${i + 1}. ${warn.message}`);
        if (warn.shopId) console.log(`   Shop ID: ${warn.shopId}`);
        if (warn.shopName) console.log(`   Shop: ${warn.shopName}`);
      });
    }

    console.log('\n=== SUMMARY ===\n');
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
  }
}

/**
 * Validate required fields
 */
function validateRequiredFields(shop, results) {
  if (!shop.id) {
    results.addError('Missing required field: id', { shopName: shop.name });
  }

  if (!shop.name) {
    results.addError('Missing required field: name', { shopId: shop.id });
  }

  if (shop.lat === undefined || shop.lat === null) {
    results.addError('Missing required field: lat', {
      shopId: shop.id,
      shopName: shop.name,
    });
  }

  if (shop.lng === undefined || shop.lng === null) {
    results.addError('Missing required field: lng', {
      shopId: shop.id,
      shopName: shop.name,
    });
  }
}

/**
 * Validate coordinate ranges
 */
function validateCoordinates(shop, results) {
  if (typeof shop.lat !== 'number' || Number.isNaN(shop.lat)) {
    results.addError('Invalid latitude (not a number)', {
      shopId: shop.id,
      shopName: shop.name,
    });
    return;
  }

  if (typeof shop.lng !== 'number' || Number.isNaN(shop.lng)) {
    results.addError('Invalid longitude (not a number)', {
      shopId: shop.id,
      shopName: shop.name,
    });
    return;
  }

  // Check USA bounds
  if (
    shop.lat < USA_BOUNDS.minLat ||
    shop.lat > USA_BOUNDS.maxLat ||
    shop.lng < USA_BOUNDS.minLng ||
    shop.lng > USA_BOUNDS.maxLng
  ) {
    results.addWarning('Coordinates outside USA bounds', {
      shopId: shop.id,
      shopName: shop.name,
    });
  }

  // Check for obviously wrong coordinates
  if (shop.lat === 0 || shop.lng === 0) {
    results.addError('Coordinates appear to be null island (0,0)', {
      shopId: shop.id,
      shopName: shop.name,
    });
  }
}

/**
 * Validate URL format
 */
function validateUrl(shop, results) {
  if (!shop.website) return;

  try {
    const url = new URL(shop.website);
    if (!['http:', 'https:'].includes(url.protocol)) {
      results.addWarning('Website has non-HTTP protocol', {
        shopId: shop.id,
        shopName: shop.name,
      });
    }
  } catch {
    results.addError('Invalid website URL format', {
      shopId: shop.id,
      shopName: shop.name,
    });
  }
}

/**
 * Validate phone format
 */
function validatePhone(shop, results) {
  if (!shop.phone) return;

  // Check for expected format: (XXX) XXX-XXXX
  const phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
  if (!phonePattern.test(shop.phone)) {
    // It's just a warning since international formats may differ
    results.addWarning('Phone not in standard format (XXX) XXX-XXXX', {
      shopId: shop.id,
      shopName: shop.name,
    });
  }
}

/**
 * Check for duplicate IDs
 */
function checkDuplicateIds(shops, results) {
  const ids = new Set();
  const duplicates = [];

  for (const shop of shops) {
    if (ids.has(shop.id)) {
      duplicates.push(shop.id);
    }
    ids.add(shop.id);
  }

  if (duplicates.length > 0) {
    results.addError(`Found ${duplicates.length} duplicate IDs: ${duplicates.join(', ')}`);
  }
}

/**
 * Check for potential duplicate shops
 */
function checkPotentialDuplicates(shops, results) {
  const seen = new Map();

  for (const shop of shops) {
    // Check by normalized name + approximate location
    const key = `${shop.name?.toLowerCase()}-${Math.round(shop.lat * 100)}-${Math.round(shop.lng * 100)}`;

    if (seen.has(key)) {
      results.addWarning('Potential duplicate shop', {
        shopId: shop.id,
        shopName: shop.name,
      });
    }
    seen.set(key, shop);
  }
}

/**
 * Validate file structure
 */
function validateStructure(data, results) {
  if (!data.shops) {
    results.addError('Missing "shops" array in file');
    return false;
  }

  if (!Array.isArray(data.shops)) {
    results.addError('"shops" is not an array');
    return false;
  }

  if (!data.lastUpdated) {
    results.addWarning('Missing "lastUpdated" field');
  }

  if (!data.version) {
    results.addWarning('Missing "version" field');
  }

  return true;
}

/**
 * Print data statistics
 */
function printStats(data) {
  const shops = data.shops;

  console.log('\n=== DATA STATISTICS ===\n');
  console.log(`Total shops: ${shops.length}`);

  const independent = shops.filter((s) => s.isIndependent).length;
  const chain = shops.filter((s) => !s.isIndependent).length;
  console.log(`Independent: ${independent} (${((independent / shops.length) * 100).toFixed(1)}%)`);
  console.log(`Chain: ${chain} (${((chain / shops.length) * 100).toFixed(1)}%)`);

  const withWebsite = shops.filter((s) => s.website).length;
  const withPhone = shops.filter((s) => s.phone).length;
  const withAddress = shops.filter((s) => s.address).length;
  console.log(`With website: ${withWebsite} (${((withWebsite / shops.length) * 100).toFixed(1)}%)`);
  console.log(`With phone: ${withPhone} (${((withPhone / shops.length) * 100).toFixed(1)}%)`);
  console.log(`With address: ${withAddress} (${((withAddress / shops.length) * 100).toFixed(1)}%)`);

  if (data.lastUpdated) {
    console.log(`Last updated: ${data.lastUpdated}`);
  }
}

/**
 * Main validation function
 */
async function main() {
  console.log('=================================');
  console.log('  Skateshop Data Validation');
  console.log('=================================');

  const results = new ValidationResults();

  // Load data
  let data;
  try {
    const content = await readFile(SHOPS_PATH, 'utf-8');
    data = JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`\nError: ${SHOPS_PATH} not found`);
      console.error('Run "npm run collect" first to generate the data file.');
      process.exit(1);
    }
    console.error(`\nError reading file: ${error.message}`);
    process.exit(1);
  }

  // Validate structure
  if (!validateStructure(data, results)) {
    results.print();
    process.exit(1);
  }

  // Validate each shop
  for (const shop of data.shops) {
    validateRequiredFields(shop, results);
    validateCoordinates(shop, results);
    validateUrl(shop, results);
    validatePhone(shop, results);
  }

  // Check for duplicates
  checkDuplicateIds(data.shops, results);
  checkPotentialDuplicates(data.shops, results);

  // Print statistics
  printStats(data);

  // Print results
  results.print();

  // Exit with error code if there are errors
  if (results.hasErrors) {
    console.log('\nValidation FAILED\n');
    process.exit(1);
  } else {
    console.log('\nValidation PASSED\n');
    process.exit(0);
  }
}

main();
