/**
 * Chain store data loader
 * Loads pre-compiled chain store locations
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CHAIN_STORES_PATH = join(__dirname, '..', 'data', 'chain-stores.json');
const MANUAL_ADDITIONS_PATH = join(__dirname, '..', 'data', 'manual-additions.json');

/**
 * Load and transform chain store data
 * All chain stores are marked as isIndependent: false
 * @returns {Promise<Array>} Array of shop objects
 */
export async function loadChainStores() {
  try {
    const data = await readFile(CHAIN_STORES_PATH, 'utf-8');
    const stores = JSON.parse(data);

    if (!Array.isArray(stores)) {
      console.warn('chain-stores.json is not an array, returning empty');
      return [];
    }

    console.log(`Loaded ${stores.length} chain stores`);

    return stores.map((store, index) => ({
      id: store.id || `chain-${index}`,
      name: store.name,
      address: store.address || null,
      lat: store.lat,
      lng: store.lng,
      website: store.website || null,
      phone: store.phone || null,
      source: 'chain',
      chainName: store.chainName || extractChainName(store.name),
      isIndependent: false,
    }));
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No chain-stores.json found, skipping');
      return [];
    }
    throw error;
  }
}

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

/**
 * Extract chain name from store name
 * e.g., "Zumiez - Mall Location" -> "Zumiez"
 */
function extractChainName(name) {
  if (!name) return null;

  const patterns = [
    /^(Zumiez)/i,
    /^(Vans)/i,
    /^(Tactics)/i,
    /^(CCS)/i,
    /^(Tilly's)/i,
    /^(PacSun)/i,
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}
