#!/usr/bin/env node

/**
 * Main shop collection script
 * Orchestrates data collection from multiple sources and processing
 */

import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { fetchFromGooglePlaces } from './sources/google-places.js';
import { fetchFromOverpass } from './sources/overpass.js';
import { loadChainStores, loadManualAdditions } from './sources/chains.js';

// Configuration: which sources to use
const USE_GOOGLE_PLACES = true;  // Primary source (recommended)
const USE_OSM = false;           // Deprecated: poor data quality
import { deduplicateShops } from './processors/deduplicator.js';
import { classifyShops, detectPotentialChains } from './processors/classifier.js';
import { normalizeShops, prepareForOutput } from './processors/normalizer.js';
import { validateAllCoordinates, isWithinUSA } from './processors/geocoder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_PATH = join(__dirname, '..', 'shops.json');

/**
 * Collect shops from all sources
 * @returns {Promise<Array>} Combined shop array
 */
async function collectFromAllSources() {
  console.log('\n=== Collecting from all sources ===\n');

  const results = {
    googlePlaces: [],
    osm: [],
    chains: [],
    manual: [],
  };

  // Build list of fetch promises based on configuration
  const fetchPromises = [];

  if (USE_GOOGLE_PLACES) {
    fetchPromises.push(
      fetchFromGooglePlaces().then(shops => { results.googlePlaces = shops; })
        .catch((err) => {
          console.error('Google Places fetch failed:', err.message);
        })
    );
  }

  if (USE_OSM) {
    fetchPromises.push(
      fetchFromOverpass().then(shops => { results.osm = shops; })
        .catch((err) => {
          console.error('OSM fetch failed:', err.message);
        })
    );
  }

  // Always load chain stores and manual additions
  fetchPromises.push(
    loadChainStores().then(shops => { results.chains = shops; })
      .catch((err) => {
        console.error('Chain stores load failed:', err.message);
      })
  );

  fetchPromises.push(
    loadManualAdditions().then(shops => { results.manual = shops; })
      .catch((err) => {
        console.error('Manual additions load failed:', err.message);
      })
  );

  await Promise.all(fetchPromises);

  console.log(`\nSource totals:`);
  if (USE_GOOGLE_PLACES) {
    console.log(`  - Google Places: ${results.googlePlaces.length} shops`);
  }
  if (USE_OSM) {
    console.log(`  - OSM: ${results.osm.length} shops (deprecated)`);
  }
  console.log(`  - Chains: ${results.chains.length} shops`);
  console.log(`  - Manual: ${results.manual.length} shops`);

  // Combine all sources (Google Places first as primary)
  return [
    ...results.googlePlaces,
    ...results.osm,
    ...results.chains,
    ...results.manual,
  ];
}

/**
 * Process collected shops through the pipeline
 * @param {Array} shops - Raw shop array
 * @returns {Promise<Array>} Processed shop array
 */
async function processShops(shops) {
  console.log('\n=== Processing shops ===\n');

  // Step 1: Filter to USA only (quick check before expensive operations)
  let processed = shops.filter((shop) => {
    if (shop.lat && shop.lng) {
      return isWithinUSA(shop.lat, shop.lng);
    }
    return true; // Keep shops without coords for now
  });
  console.log(`After USA filter: ${processed.length} shops`);

  // Step 2: Deduplicate
  processed = deduplicateShops(processed);

  // Step 3: Validate coordinates (skip geocoding to avoid rate limits)
  processed = await validateAllCoordinates(processed, {
    enrichMissingAddress: false, // Set to true if you want address enrichment
  });

  // Step 4: Classify independent vs chain
  processed = classifyShops(processed);

  // Step 5: Detect potential unknown chains (for logging only)
  const potentialChains = detectPotentialChains(processed);
  if (potentialChains.length > 0) {
    console.log(`\nPotential unknown chains detected:`);
    potentialChains.slice(0, 5).forEach((chain) => {
      console.log(`  - "${chain.name}" (${chain.locationCount} locations)`);
    });
  }

  // Step 6: Normalize all data
  processed = normalizeShops(processed);

  return processed;
}

/**
 * Generate sequential numeric IDs for shops
 * @param {Array} shops - Shop array
 * @returns {Array} Shops with numeric IDs
 */
function assignNumericIds(shops) {
  return shops.map((shop, index) => ({
    ...shop,
    id: index + 1,
  }));
}

/**
 * Write shops to output file
 * @param {Array} shops - Processed shop array
 */
async function writeOutput(shops) {
  console.log('\n=== Writing output ===\n');

  // Assign sequential numeric IDs
  const withIds = assignNumericIds(shops);

  // Prepare for output (remove internal metadata)
  const output = prepareForOutput(withIds);

  // Sort by name for consistent output
  output.sort((a, b) => a.name.localeCompare(b.name));

  const data = {
    shops: output,
    lastUpdated: new Date().toISOString().split('T')[0],
    version: '1.0',
    stats: {
      total: output.length,
      independent: output.filter((s) => s.isIndependent).length,
      chain: output.filter((s) => !s.isIndependent).length,
      withWebsite: output.filter((s) => s.website).length,
      withPhone: output.filter((s) => s.phone).length,
    },
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(data, null, 2) + '\n');

  console.log(`Written ${output.length} shops to ${OUTPUT_PATH}`);
  console.log(`\nStats:`);
  console.log(`  - Total: ${data.stats.total}`);
  console.log(`  - Independent: ${data.stats.independent}`);
  console.log(`  - Chain: ${data.stats.chain}`);
  console.log(`  - With website: ${data.stats.withWebsite}`);
  console.log(`  - With phone: ${data.stats.withPhone}`);
}

/**
 * Main entry point
 */
async function main() {
  console.log('=================================');
  console.log('  Skateshop Data Collection');
  console.log('=================================');

  try {
    // Collect from all sources
    const rawShops = await collectFromAllSources();

    if (rawShops.length === 0) {
      console.error('\nNo shops collected from any source!');
      process.exit(1);
    }

    // Process through pipeline
    const processedShops = await processShops(rawShops);

    if (processedShops.length === 0) {
      console.error('\nNo shops remained after processing!');
      process.exit(1);
    }

    // Write output
    await writeOutput(processedShops);

    console.log('\n=================================');
    console.log('  Collection complete!');
    console.log('=================================\n');
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}

main();
