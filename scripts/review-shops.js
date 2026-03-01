#!/usr/bin/env node

/**
 * Interactive CLI for reviewing pending shops
 * Allows manual approval or denial of uncertain shop entries
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PENDING_PATH = join(__dirname, 'data', 'pending-review.json');
const APPROVED_PATH = join(__dirname, 'data', 'approved-shops.json');
const REMOVED_PATH = join(__dirname, 'data', 'removed-shops.json');
const SHOPS_PATH = join(__dirname, '..', 'shops.json');

/**
 * Load JSON file with fallback to empty array
 */
function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Save JSON file with pretty formatting
 */
function saveJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

/**
 * Load shops.json file
 */
function loadShopsFile() {
  try {
    const data = JSON.parse(readFileSync(SHOPS_PATH, 'utf8'));
    return data;
  } catch {
    return { shops: [], lastUpdated: null, version: '1.0', stats: {} };
  }
}

/**
 * Display shop information for review
 */
function displayShop(shop, index, total) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Shop ${index + 1} of ${total}`);
  console.log('='.repeat(60));
  console.log(`Name:    ${shop.name || 'N/A'}`);
  console.log(`Types:   ${(shop.types || []).join(', ') || 'N/A'}`);
  console.log(`Address: ${shop.address || 'N/A'}`);
  console.log(`Phone:   ${shop.phone || 'N/A'}`);
  console.log(`Website: ${shop.website || 'N/A'}`);
  if (shop.googlePlaceId) {
    console.log(
      `Google Maps: https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${shop.googlePlaceId}`
    );
  }
  if (shop.confidenceReason) {
    console.log(`Reason:  ${shop.confidenceReason}`);
  }
  console.log('-'.repeat(60));
}

/**
 * Prompt user for action
 */
function promptAction(rl) {
  return new Promise((resolve) => {
    rl.question('[A]pprove, [D]eny, [S]kip, [Q]uit? ', (answer) => {
      resolve(answer.toLowerCase().trim());
    });
  });
}

/**
 * Add shop to shops.json
 */
function addToShops(shop, shopsData) {
  // Generate new ID (max existing + 1)
  const maxId = shopsData.shops.reduce((max, s) => Math.max(max, s.id || 0), 0);

  const newShop = {
    id: maxId + 1,
    name: shop.name,
    address: shop.address,
    lat: shop.lat,
    lng: shop.lng,
    website: shop.website || null,
    phone: shop.phone || null,
    isIndependent: shop.isIndependent !== undefined ? shop.isIndependent : true,
  };

  // Remove null values
  Object.keys(newShop).forEach((key) => {
    if (newShop[key] === null || newShop[key] === undefined) {
      delete newShop[key];
    }
  });

  shopsData.shops.push(newShop);
  shopsData.stats.total = shopsData.shops.length;
  shopsData.stats.independent = shopsData.shops.filter((s) => s.isIndependent).length;
  shopsData.stats.chain = shopsData.shops.filter((s) => !s.isIndependent).length;
  shopsData.lastUpdated = new Date().toISOString().split('T')[0];

  return shopsData;
}

/**
 * Main review loop
 */
async function main() {
  console.log('=================================');
  console.log('  Shop Review Tool');
  console.log('=================================\n');

  // Load all data files
  const pending = loadJson(PENDING_PATH);
  const approved = loadJson(APPROVED_PATH);
  const removed = loadJson(REMOVED_PATH);
  let shopsData = loadShopsFile();

  if (pending.length === 0) {
    console.log('No shops pending review.');
    console.log('Run "npm run collect" to populate the pending review list.');
    process.exit(0);
  }

  console.log(`${pending.length} shops pending review.`);
  console.log(`${approved.length} previously approved.`);
  console.log(`${removed.length} previously removed.`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const remaining = [];
  let approvedCount = 0;
  let deniedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < pending.length; i++) {
    const shop = pending[i];

    displayShop(shop, i, pending.length);

    let validAction = false;
    while (!validAction) {
      const action = await promptAction(rl);

      switch (action) {
        case 'a':
        case 'approve':
          // Add to approved list
          if (shop.googlePlaceId && !approved.includes(shop.googlePlaceId)) {
            approved.push(shop.googlePlaceId);
          }
          // Add to shops.json
          shopsData = addToShops(shop, shopsData);
          approvedCount++;
          console.log('-> Approved');
          validAction = true;
          break;

        case 'd':
        case 'deny':
          // Add to removed list
          if (shop.googlePlaceId && !removed.includes(shop.googlePlaceId)) {
            removed.push(shop.googlePlaceId);
          }
          deniedCount++;
          console.log('-> Denied');
          validAction = true;
          break;

        case 's':
        case 'skip':
          // Keep in pending
          remaining.push(shop);
          skippedCount++;
          console.log('-> Skipped');
          validAction = true;
          break;

        case 'q':
        case 'quit':
          // Add remaining shops back to pending
          remaining.push(...pending.slice(i));
          console.log('\nQuitting...');
          validAction = true;
          i = pending.length; // Exit loop
          break;

        default:
          console.log('Invalid option. Use A, D, S, or Q.');
      }
    }
  }

  rl.close();

  // Save all files
  saveJson(APPROVED_PATH, approved);
  saveJson(REMOVED_PATH, removed);
  saveJson(PENDING_PATH, remaining);
  saveJson(SHOPS_PATH, shopsData);

  // Summary
  console.log('\n=================================');
  console.log('  Review Complete');
  console.log('=================================');
  console.log(`Approved: ${approvedCount}`);
  console.log(`Denied:   ${deniedCount}`);
  console.log(`Skipped:  ${skippedCount}`);
  console.log(`Remaining: ${remaining.length}`);
  console.log(`Total shops in database: ${shopsData.shops.length}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
