/**
 * OpenStreetMap Overpass API integration
 * Fetches skateshop data from OSM
 */

import fetch from 'node-fetch';

// USA bounding box (south, west, north, east)
const USA_BBOX = '24.5,-125.0,49.5,-66.5';

// Overpass API endpoints (use multiple for redundancy)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Build Overpass QL query for skateshops in USA
 * Targets: shop=skate, shop=sports with skateboard tags
 */
function buildQuery() {
  return `
[out:json][timeout:120];
(
  // Dedicated skate shops
  node["shop"="skate"](${USA_BBOX});
  way["shop"="skate"](${USA_BBOX});

  // Sports shops with skateboard focus
  node["shop"="sports"]["sport"="skateboard"](${USA_BBOX});
  way["shop"="sports"]["sport"="skateboard"](${USA_BBOX});

  // Shops tagged with skateboard in name or other fields
  node["shop"]["skateboard"="yes"](${USA_BBOX});
  way["shop"]["skateboard"="yes"](${USA_BBOX});
);
out center;
`.trim();
}

/**
 * Extract coordinates from OSM element
 * Handles both nodes (direct lat/lon) and ways (center point)
 */
function extractCoordinates(element) {
  if (element.lat !== undefined && element.lon !== undefined) {
    return { lat: element.lat, lng: element.lon };
  }
  if (element.center) {
    return { lat: element.center.lat, lng: element.center.lon };
  }
  return null;
}

/**
 * Build address string from OSM tags
 */
function buildAddress(tags) {
  const parts = [];

  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }

  if (tags['addr:city']) {
    parts.push(tags['addr:city']);
  }

  if (tags['addr:state']) {
    parts.push(tags['addr:state']);
  }

  if (tags['addr:postcode']) {
    parts.push(tags['addr:postcode']);
  }

  return parts.join(', ') || null;
}

/**
 * Normalize website URL
 */
function normalizeWebsite(url) {
  if (!url) return null;

  let normalized = url.trim();

  // Remove common prefixes that aren't URLs
  if (normalized.startsWith('www.')) {
    normalized = `https://${normalized}`;
  }

  // Add protocol if missing
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = `https://${normalized}`;
  }

  try {
    new URL(normalized);
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Transform OSM element to shop object
 */
function transformElement(element) {
  const tags = element.tags || {};
  const coords = extractCoordinates(element);

  if (!coords) {
    return null;
  }

  const name = tags.name || tags['name:en'] || 'Unknown Skateshop';

  return {
    id: `osm-${element.type}-${element.id}`,
    name: name,
    address: buildAddress(tags),
    lat: coords.lat,
    lng: coords.lng,
    website: normalizeWebsite(tags.website || tags['contact:website']),
    phone: tags.phone || tags['contact:phone'] || null,
    source: 'osm',
    osmId: element.id,
    osmType: element.type,
    rawTags: tags,
  };
}

/**
 * Fetch skateshops from Overpass API
 * @returns {Promise<Array>} Array of shop objects
 */
export async function fetchFromOverpass() {
  const query = buildQuery();

  let lastError;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`Fetching from ${endpoint}...`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.elements || !Array.isArray(data.elements)) {
        throw new Error('Invalid response structure');
      }

      console.log(`Found ${data.elements.length} elements from OSM`);

      const shops = data.elements.map(transformElement).filter((shop) => shop !== null);

      console.log(`Transformed ${shops.length} valid shops`);

      return shops;
    } catch (error) {
      console.error(`Error with ${endpoint}:`, error.message);
      lastError = error;
    }
  }

  throw new Error(`All Overpass endpoints failed: ${lastError?.message}`);
}
