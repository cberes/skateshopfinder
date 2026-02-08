/**
 * Deduplication processor
 * Removes duplicate shops using multiple matching strategies
 */

// Distance threshold for coordinate matching (~11 meters = 0.0001 degrees)
const COORDINATE_THRESHOLD = 0.0001;

/**
 * Calculate distance between two coordinate pairs
 * Uses simple Euclidean distance (sufficient for small distances)
 */
function coordinateDistance(lat1, lng1, lat2, lng2) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2);
}

/**
 * Normalize a string for comparison
 * Removes common suffixes, punctuation, and extra whitespace
 */
function normalizeForComparison(str) {
  if (!str) return '';

  return str
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(skate\s*shop|skateshop|skate\s*store|shop|store|inc|llc|ltd|co)\b/gi, '')
    .trim();
}

/**
 * Extract city from address string
 */
function extractCity(address) {
  if (!address) return null;

  // Try to match city before state abbreviation
  const match = address.match(/,\s*([^,]+),\s*[A-Z]{2}\b/i);
  if (match) {
    return normalizeForComparison(match[1]);
  }

  return null;
}

/**
 * Check if two shops are duplicates by coordinates
 */
function matchByCoordinates(shop1, shop2) {
  if (!shop1.lat || !shop1.lng || !shop2.lat || !shop2.lng) {
    return false;
  }

  const distance = coordinateDistance(shop1.lat, shop1.lng, shop2.lat, shop2.lng);
  return distance < COORDINATE_THRESHOLD;
}

/**
 * Check if two shops are duplicates by name + city
 */
function matchByNameAndCity(shop1, shop2) {
  const name1 = normalizeForComparison(shop1.name);
  const name2 = normalizeForComparison(shop2.name);

  if (!name1 || !name2 || name1 !== name2) {
    return false;
  }

  const city1 = extractCity(shop1.address);
  const city2 = extractCity(shop2.address);

  // If both have cities, they must match
  if (city1 && city2) {
    return city1 === city2;
  }

  // If only one has a city, consider it a potential match
  // (will be validated by other means)
  return true;
}

/**
 * Check if two shops are duplicates by address
 */
function matchByAddress(shop1, shop2) {
  if (!shop1.address || !shop2.address) {
    return false;
  }

  const addr1 = normalizeForComparison(shop1.address);
  const addr2 = normalizeForComparison(shop2.address);

  // Exact match
  if (addr1 === addr2) {
    return true;
  }

  // Check if street addresses match (first part before first comma)
  const street1 = addr1.split(',')[0]?.trim();
  const street2 = addr2.split(',')[0]?.trim();

  if (street1 && street2 && street1 === street2) {
    // Also check if same city
    const city1 = extractCity(shop1.address);
    const city2 = extractCity(shop2.address);
    if (city1 && city2 && city1 === city2) {
      return true;
    }
  }

  return false;
}

/**
 * Check if two shops are duplicates
 */
function areDuplicates(shop1, shop2) {
  return (
    matchByCoordinates(shop1, shop2) ||
    matchByNameAndCity(shop1, shop2) ||
    matchByAddress(shop1, shop2)
  );
}

/**
 * Merge two shop records, preferring more complete data
 * @param {Object} existing - Existing shop record
 * @param {Object} incoming - New shop record to merge
 * @returns {Object} Merged shop record
 */
function mergeShops(existing, incoming) {
  // Prefer data from chain/manual sources over OSM
  const sourcePriority = { chain: 3, manual: 2, osm: 1 };
  const existingPriority = sourcePriority[existing.source] || 0;
  const incomingPriority = sourcePriority[incoming.source] || 0;

  const base = incomingPriority > existingPriority ? incoming : existing;
  const other = incomingPriority > existingPriority ? existing : incoming;

  return {
    id: base.id,
    name: base.name || other.name,
    address: base.address || other.address,
    lat: base.lat || other.lat,
    lng: base.lng || other.lng,
    website: base.website || other.website,
    phone: base.phone || other.phone,
    source: base.source,
    // Keep Google Places metadata
    googlePlaceId: base.googlePlaceId || other.googlePlaceId,
    types: base.types || other.types,
    // Keep both OSM IDs if available
    osmId: base.osmId || other.osmId,
    osmType: base.osmType || other.osmType,
    // Merge sources for tracking
    mergedFrom: [
      ...(base.mergedFrom || [base.source]),
      ...(other.mergedFrom || [other.source]),
    ].filter((v, i, a) => a.indexOf(v) === i),
  };
}

/**
 * Deduplicate an array of shops
 * @param {Array} shops - Array of shop objects
 * @returns {Array} Deduplicated array
 */
export function deduplicateShops(shops) {
  console.log(`Deduplicating ${shops.length} shops...`);

  const unique = [];
  let duplicateCount = 0;

  for (const shop of shops) {
    let foundDuplicate = false;

    // TODO this is probably slow
    for (let i = 0; i < unique.length; i++) {
      if (areDuplicates(unique[i], shop)) {
        unique[i] = mergeShops(unique[i], shop);
        foundDuplicate = true;
        duplicateCount++;
        break;
      }
    }

    if (!foundDuplicate) {
      unique.push({ ...shop });
    }
  }

  console.log(`Removed ${duplicateCount} duplicates, ${unique.length} unique shops remain`);

  return unique;
}
