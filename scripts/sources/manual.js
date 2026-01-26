/**
 * Manual additions data loader
 * Loads community-submitted shop data
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MANUAL_ADDITIONS_PATH = join(__dirname, '..', 'data', 'manual-additions.json');

/**
 * Load manual additions (community-submitted shops)
 * @returns {Promise<Array>} Array of shop objects
 */
export async function loadManualAdditions() {
  try {
    const data = await readFile(MANUAL_ADDITIONS_PATH, 'utf-8');
    const stores = JSON.parse(data);

    if (!Array.isArray(stores)) {
      console.warn('manual-additions.json is not an array, returning empty');
      return [];
    }

    console.log(`Loaded ${stores.length} manual additions`);

    return stores.map((store, index) => ({
      id: store.id || `manual-${index}`,
      name: store.name,
      address: store.address || null,
      lat: store.lat,
      lng: store.lng,
      website: store.website || null,
      phone: store.phone || null,
      source: 'manual',
      isIndependent: store.isIndependent !== false,
    }));
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No manual-additions.json found, skipping');
      return [];
    }
    throw error;
  }
}
