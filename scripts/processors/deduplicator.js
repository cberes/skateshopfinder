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
 * Pre-compute normalized values for a shop to avoid repeated regex operations
 */
function precomputeNormalized(shop) {
  const normalizedAddress = normalizeForComparison(shop.address);
  return {
    shop,
    name: normalizeForComparison(shop.name),
    address: normalizedAddress,
    street: normalizedAddress.split(',')[0]?.trim() || '',
    city: extractCity(shop.address),
  };
}

/**
 * Check if two shops are duplicates by coordinates
 */
function matchByCoordinates(entry1, entry2) {
  const shop1 = entry1.shop;
  const shop2 = entry2.shop;
  if (!shop1.lat || !shop1.lng || !shop2.lat || !shop2.lng) {
    return false;
  }

  const distance = coordinateDistance(shop1.lat, shop1.lng, shop2.lat, shop2.lng);
  return distance < COORDINATE_THRESHOLD;
}

/**
 * Check if two shops are duplicates by name + city
 */
function matchByNameAndCity(entry1, entry2) {
  if (!entry1.name || !entry2.name || entry1.name !== entry2.name) {
    return false;
  }

  // If both have cities, they must match
  if (entry1.city && entry2.city) {
    return entry1.city === entry2.city;
  }

  // If only one has a city, consider it a potential match
  // (will be validated by other means)
  return true;
}

/**
 * Check if two shops are duplicates by address
 */
function matchByAddress(entry1, entry2) {
  if (!entry1.address || !entry2.address) {
    return false;
  }

  // Exact match
  if (entry1.address === entry2.address) {
    return true;
  }

  // Check if street addresses match (first part before first comma)
  if (entry1.street && entry2.street && entry1.street === entry2.street) {
    // Also check if same city
    if (entry1.city && entry2.city && entry1.city === entry2.city) {
      return true;
    }
  }

  return false;
}

/**
 * Check if two shops are duplicates using pre-computed normalized data
 */
function areDuplicates(entry1, entry2) {
  return (
    matchByCoordinates(entry1, entry2) ||
    matchByNameAndCity(entry1, entry2) ||
    matchByAddress(entry1, entry2)
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

  // Pre-compute normalized values once per shop
  const entries = shops.map(precomputeNormalized);

  const unique = [];
  let duplicateCount = 0;

  for (const entry of entries) {
    let foundDuplicate = false;

    for (let i = 0; i < unique.length; i++) {
      if (areDuplicates(unique[i], entry)) {
        // Merge shops and recompute normalized values for merged result
        const merged = mergeShops(unique[i].shop, entry.shop);
        unique[i] = precomputeNormalized(merged);
        foundDuplicate = true;
        duplicateCount++;
        break;
      }
    }

    if (!foundDuplicate) {
      unique.push(entry);
    }
  }

  console.log(`Removed ${duplicateCount} duplicates, ${unique.length} unique shops remain`);

  return unique.map((entry) => entry.shop);
}
