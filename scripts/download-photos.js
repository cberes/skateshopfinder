#!/usr/bin/env node

/**
 * Download storefront photos from Google Places Photo Media API
 *
 * Reads shops.json, downloads photos for shops with photoName references,
 * saves them as static images, and updates shops.json with photo filenames.
 *
 * Requires GOOGLE_PLACES_API_KEY environment variable.
 *
 * Usage: npm run download:photos
 */

import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import fetch from 'node-fetch';
import { RateLimiter } from './utils/rate-limiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SHOPS_PATH = join(__dirname, '..', 'shops.json');
const IMAGES_DIR = join(__dirname, '..', 'images', 'shops');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PHOTO_MEDIA_BASE = 'https://places.googleapis.com/v1';

// Rate limit: 5 requests per second (conservative)
const rateLimiter = new RateLimiter(5);

/**
 * Extract stable place ID from a photo resource name
 * e.g. "places/ChIJabc123/photos/AelY_xyz" -> "ChIJabc123"
 * @param {string} photoName - Photo resource name
 * @returns {string} Place ID
 */
function extractPlaceId(photoName) {
  const parts = photoName.split('/');
  // Format: places/{placeId}/photos/{photoRef}
  return parts[1];
}

/**
 * Download a single photo from Google Places Photo Media API
 * @param {string} photoName - Photo resource name (e.g. "places/ChIJ.../photos/AelY...")
 * @param {string} outputPath - Path to save the image
 * @returns {Promise<boolean>} True if download succeeded
 */
async function downloadPhoto(photoName, outputPath) {
  const url = `${PHOTO_MEDIA_BASE}/${photoName}/media?maxHeightPx=400&maxWidthPx=600&skipHttpRedirect=true`;

  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const photoUri = data.photoUri;

  if (!photoUri) {
    throw new Error('No photoUri in response');
  }

  // Download the actual image
  const imageResponse = await fetch(photoUri);
  if (!imageResponse.ok) {
    throw new Error(`Image download failed: HTTP ${imageResponse.status}`);
  }

  await pipeline(imageResponse.body, createWriteStream(outputPath));
  return true;
}

/**
 * Main entry point
 */
async function main() {
  console.log('=== Download Storefront Photos ===\n');

  if (!API_KEY) {
    console.error('GOOGLE_PLACES_API_KEY environment variable is not set.');
    console.error('Set it and try again: export GOOGLE_PLACES_API_KEY=your_key_here');
    process.exit(1);
  }

  // Read shops.json
  const shopsData = JSON.parse(await readFile(SHOPS_PATH, 'utf8'));
  const shops = shopsData.shops;

  // Find shops with photoName
  const shopsWithPhoto = shops.filter((s) => s.photoName);
  console.log(
    `Found ${shopsWithPhoto.length} shops with photo references (out of ${shops.length} total)\n`
  );

  if (shopsWithPhoto.length === 0) {
    console.log('No photos to download. Run "npm run collect" first to populate photoName fields.');
    return;
  }

  // Ensure output directory exists
  mkdirSync(IMAGES_DIR, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < shopsWithPhoto.length; i++) {
    const shop = shopsWithPhoto[i];
    const placeId = extractPlaceId(shop.photoName);
    const filename = `${placeId}.jpg`;
    const outputPath = join(IMAGES_DIR, filename);

    process.stdout.write(
      `\r  [${i + 1}/${shopsWithPhoto.length}] Downloading photos... (${downloaded} done, ${skipped} skipped, ${failed} failed)`
    );

    // Skip if already downloaded (uses stable place ID, not sequential shop ID)
    if (existsSync(outputPath)) {
      skipped++;
      continue;
    }

    await rateLimiter.wait();

    try {
      await downloadPhoto(shop.photoName, outputPath);
      downloaded++;
    } catch (error) {
      failed++;
      console.error(`\n  Failed ${shop.name} (${placeId}): ${error.message}`);
    }
  }

  console.log(`\n\nDownload complete:`);
  console.log(`  - Downloaded: ${downloaded}`);
  console.log(`  - Skipped (already exists): ${skipped}`);
  console.log(`  - Failed: ${failed}`);

  // Rewrite shops.json: replace photoName with photo for shops that have images
  console.log('\nUpdating shops.json...');
  let photosAdded = 0;

  for (const shop of shops) {
    if (shop.photoName) {
      const placeId = extractPlaceId(shop.photoName);
      const filename = `${placeId}.jpg`;
      const imagePath = join(IMAGES_DIR, filename);

      if (existsSync(imagePath)) {
        shop.photo = filename;
        photosAdded++;
      }

      delete shop.photoName;
    }
  }

  // Update stats
  shopsData.stats.withPhoto = photosAdded;

  await writeFile(SHOPS_PATH, `${JSON.stringify(shopsData, null, 2)}\n`);
  console.log(`Updated shops.json: ${photosAdded} shops now have photos`);
}

main().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
