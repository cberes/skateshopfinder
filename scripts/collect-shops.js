#!/usr/bin/env node

/**
 * Main shop collection script
 * Orchestrates data collection from multiple sources and processing
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { transformGooglePlacesData } from './sources/google-places.js';
import { loadManualAdditions } from './sources/manual.js';
import { fetchFromOverpass } from './sources/overpass.js';

// Configuration: which sources to use
const USE_GOOGLE_PLACES = true; // Primary source (recommended)
const USE_OSM = false; // Deprecated: poor data quality

import {
  calculateConfidence,
  classifyShops,
  detectPotentialChains,
} from './processors/classifier.js';
import { deduplicateShops } from './processors/deduplicator.js';
import { isWithinUSA, validateAllCoordinates } from './processors/geocoder.js';
import { normalizeShops, prepareForOutput } from './processors/normalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_PATH = join(__dirname, '..', 'shops.json');
const REMOVED_PATH = join(__dirname, 'data', 'removed-shops.json');
const APPROVED_PATH = join(__dirname, 'data', 'approved-shops.json');
const PENDING_PATH = join(__dirname, 'data', 'pending-review.json');
const RAW_DATA_PATH = join(__dirname, 'data', 'google-places-raw.json');

/**
 * Load decision files (removed and approved shop IDs)
 * @returns {Object} Sets of removed and approved place IDs
 */
async function loadDecisionFiles() {
  let removed = [];
  let approved = [];

  try {
    removed = JSON.parse(await readFile(REMOVED_PATH, 'utf8'));
  } catch {
    // File doesn't exist or is invalid, use empty array
  }

  try {
    approved = JSON.parse(await readFile(APPROVED_PATH, 'utf8'));
  } catch {
    // File doesn't exist or is invalid, use empty array
  }

  return {
    removedIds: new Set(removed),
    approvedIds: new Set(approved),
  };
}

/**
 * Load raw Google Places data from intermediate file
 * @returns {Promise<Object|null>} Raw data object or null if not found
 */
async function loadRawGooglePlacesData() {
  if (!existsSync(RAW_DATA_PATH)) {
    return null;
  }

  try {
    const content = await readFile(RAW_DATA_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Failed to parse raw data file:', err.message);
    return null;
  }
}

/**
 * Collect shops from all sources
 * @returns {Promise<Array>} Combined shop array
 */
async function collectFromAllSources() {
  console.log('\n=== Collecting from all sources ===\n');

  const results = {
    googlePlaces: [],
    osm: [],
    manual: [],
  };

  // Build list of fetch promises based on configuration
  const fetchPromises = [];

  if (USE_GOOGLE_PLACES) {
    // Check for cached raw data first
    const rawData = await loadRawGooglePlacesData();

    if (rawData) {
      console.log(`Found cached raw data from ${rawData.fetchedAt}`);
      console.log(`  - ${rawData.stats.totalMetros} metros, ${rawData.stats.totalPlaces} places`);

      try {
        results.googlePlaces = transformGooglePlacesData(rawData);
      } catch (err) {
        console.error('Google Places transform failed:', err.message);
      }
    } else {
      console.error('\nNo cached raw data found at:', RAW_DATA_PATH);
      console.error('\nPlease run "npm run fetch" first to fetch data from Google Places API.');
      console.error(
        'This separates API calls from processing, allowing re-runs without burning quota.\n'
      );
      process.exit(1);
    }
  }

  if (USE_OSM) {
    fetchPromises.push(
      fetchFromOverpass()
        .then((shops) => {
          results.osm = shops;
        })
        .catch((err) => {
          console.error('OSM fetch failed:', err.message);
        })
    );
  }

  // Load manual additions (community-submitted shops)
  fetchPromises.push(
    loadManualAdditions()
      .then((shops) => {
        results.manual = shops;
      })
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
  console.log(`  - Manual: ${results.manual.length} shops`);

  // Combine all sources (Google Places first as primary)
  return [...results.googlePlaces, ...results.osm, ...results.manual];
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
 * Apply confidence-based filtering to shops
 * @param {Array} shops - Processed shop array
 * @param {Object} decisions - Object with removedIds and approvedIds Sets
 * @returns {Object} Object with included shops and pending review shops
 */
function applyConfidenceFilter(shops, decisions) {
  const { removedIds, approvedIds } = decisions;

  const included = [];
  const pendingReview = [];
  let excludedCount = 0;
  let removedCount = 0;

  for (const shop of shops) {
    const placeId = shop.googlePlaceId;

    // Skip shops that were previously removed
    if (placeId && removedIds.has(placeId)) {
      removedCount++;
      continue;
    }

    // Auto-include shops that were previously approved
    if (placeId && approvedIds.has(placeId)) {
      included.push(shop);
      continue;
    }

    // Calculate confidence for remaining shops
    const confidence = calculateConfidence(shop);

    switch (confidence.level) {
      case 'high':
      case 'very_high':
      case 'good':
        included.push(shop);
        break;
      case 'review':
        pendingReview.push({
          ...shop,
          confidenceReason: confidence.reason,
        });
        break;
      default:
        excludedCount++;
        break;
    }
  }

  console.log(`\nConfidence filtering results:`);
  console.log(`  - Included: ${included.length} shops`);
  console.log(`  - Pending review: ${pendingReview.length} shops`);
  console.log(`  - Excluded: ${excludedCount} shops`);
  console.log(`  - Previously removed: ${removedCount} shops`);

  return { included, pendingReview };
}

/**
 * Write pending review shops to file
 * @param {Array} shops - Shops pending review
 */
async function writePendingReview(shops) {
  await writeFile(PENDING_PATH, `${JSON.stringify(shops, null, 2)}\n`);
  if (shops.length > 0) {
    console.log(`\nWritten ${shops.length} shops to pending review.`);
    console.log(`Run "npm run review" to manually review them.`);
  }
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
      withPhoto: output.filter((s) => s.photoName || s.photo).length,
    },
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`);

  console.log(`Written ${output.length} shops to ${OUTPUT_PATH}`);
  console.log(`\nStats:`);
  console.log(`  - Total: ${data.stats.total}`);
  console.log(`  - Independent: ${data.stats.independent}`);
  console.log(`  - Chain: ${data.stats.chain}`);
  console.log(`  - With website: ${data.stats.withWebsite}`);
  console.log(`  - With phone: ${data.stats.withPhone}`);
  console.log(`  - With photo: ${data.stats.withPhoto}`);
}

/**
 * Main entry point
 */
async function main() {
  console.log('=================================');
  console.log('  Skateshop Data Collection');
  console.log('=================================');

  try {
    // Load decision files (removed/approved shop IDs)
    const decisions = await loadDecisionFiles();
    console.log(
      `\nLoaded ${decisions.removedIds.size} removed, ${decisions.approvedIds.size} approved shop IDs`
    );

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

    // Apply confidence-based filtering
    const { included, pendingReview } = applyConfidenceFilter(processedShops, decisions);

    if (included.length === 0) {
      console.error('\nNo shops passed confidence filter!');
      process.exit(1);
    }

    // Write outputs
    await writeOutput(included);
    await writePendingReview(pendingReview);

    console.log('\n=================================');
    console.log('  Collection complete!');
    console.log('=================================\n');
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}

main();
