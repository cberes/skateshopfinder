#!/usr/bin/env node

/**
 * Fetch raw data from Google Places API
 * Saves to intermediate file for processing by collect-shops.js
 *
 * This separates API calls from data processing, allowing re-runs
 * of processing without burning API quota.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchRawFromGooglePlaces } from './sources/google-places.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RAW_DATA_PATH = join(__dirname, 'data', 'google-places-raw.json');

async function main() {
  console.log('=================================');
  console.log('  Fetching Raw Google Places Data');
  console.log('=================================');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log('\n[DRY RUN MODE]');
  }

  try {
    const rawResults = await fetchRawFromGooglePlaces({ dryRun });

    if (dryRun) {
      console.log('\nDry run complete. No data saved.');
      return;
    }

    if (rawResults.metros.length === 0) {
      console.error('\nNo data fetched from API!');
      process.exit(1);
    }

    const output = {
      fetchedAt: new Date().toISOString(),
      apiVersion: 'v1',
      stats: {
        totalMetros: rawResults.metros.length,
        totalPlaces: rawResults.totalPlaces,
        totalRequests: rawResults.requestCount,
      },
      metros: rawResults.metros,
    };

    writeFileSync(RAW_DATA_PATH, `${JSON.stringify(output, null, 2)}\n`);

    console.log(`\n=================================`);
    console.log(`  Fetch complete!`);
    console.log(`=================================`);
    console.log(`\nSaved raw data to: ${RAW_DATA_PATH}`);
    console.log(`\nStats:`);
    console.log(`  - Metros searched: ${output.stats.totalMetros}`);
    console.log(`  - Total places: ${output.stats.totalPlaces}`);
    console.log(`  - API requests used: ${output.stats.totalRequests}`);
    console.log(`\nNext step: Run "npm run collect" to process the data.`);
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}

main();
