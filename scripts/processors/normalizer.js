/**
 * Data normalization processor
 * Cleans and formats shop data consistently
 */

/**
 * Clean and normalize shop name
 * @param {string} name - Raw shop name
 * @returns {string} Normalized name
 */
function normalizeName(name) {
  if (!name) return 'Unknown Skateshop';

  return name
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Fix common encoding issues
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    // Normalize quotes
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"');
}

/**
 * Format phone number to consistent format: (XXX) XXX-XXXX
 * @param {string} phone - Raw phone number
 * @returns {string|null} Formatted phone or null
 */
function normalizePhone(phone) {
  if (!phone) return null;

  // Extract digits only
  const digits = phone.replace(/\D/g, '');

  // Handle different digit lengths
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Handle 11 digits starting with 1 (US country code)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original if format unknown (might be international)
  return phone.trim();
}

/**
 * Validate and normalize website URL
 * @param {string} url - Raw URL
 * @returns {string|null} Normalized URL or null
 */
function normalizeWebsite(url) {
  if (!url) return null;

  let normalized = url.trim();

  // Skip invalid entries
  if (normalized.length < 4) return null;
  if (normalized === 'http://' || normalized === 'https://') return null;

  // Add protocol if missing
  if (!normalized.match(/^https?:\/\//i)) {
    if (normalized.startsWith('www.')) {
      normalized = 'https://' + normalized;
    } else if (normalized.includes('.')) {
      normalized = 'https://' + normalized;
    } else {
      return null; // Not a valid URL
    }
  }

  // Validate URL structure
  try {
    const parsed = new URL(normalized);

    // Must have a valid domain
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null;
    }

    // Normalize to lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove trailing slash from path if it's just "/"
    if (parsed.pathname === '/') {
      return `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}`;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Normalize address string
 * @param {string} address - Raw address
 * @returns {string|null} Normalized address or null
 */
function normalizeAddress(address) {
  if (!address) return null;

  return address
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Fix common abbreviations
    .replace(/\bSt\b(?!\.)/g, 'St.')
    .replace(/\bAve\b(?!\.)/g, 'Ave.')
    .replace(/\bBlvd\b(?!\.)/g, 'Blvd.')
    .replace(/\bRd\b(?!\.)/g, 'Rd.')
    .replace(/\bDr\b(?!\.)/g, 'Dr.')
    .replace(/\bLn\b(?!\.)/g, 'Ln.')
    .replace(/\bCt\b(?!\.)/g, 'Ct.')
    .replace(/\bPl\b(?!\.)/g, 'Pl.')
    // Normalize comma spacing
    .replace(/\s*,\s*/g, ', ');
}

/**
 * Round coordinates to 6 decimal places
 * 6 decimal places gives ~0.1 meter precision
 * @param {number} coord - Coordinate value
 * @returns {number} Rounded coordinate
 */
function normalizeCoordinate(coord) {
  if (typeof coord !== 'number' || isNaN(coord)) {
    return null;
  }
  return Math.round(coord * 1000000) / 1000000;
}

/**
 * Normalize a single shop object
 * @param {Object} shop - Raw shop object
 * @returns {Object} Normalized shop
 */
export function normalizeShop(shop) {
  return {
    id: shop.id,
    name: normalizeName(shop.name),
    address: normalizeAddress(shop.address),
    lat: normalizeCoordinate(shop.lat),
    lng: normalizeCoordinate(shop.lng),
    website: normalizeWebsite(shop.website),
    phone: normalizePhone(shop.phone),
    isIndependent: shop.isIndependent,
    // Preserve metadata for debugging but don't include in final output
    _source: shop.source,
    _osmId: shop.osmId,
    _mergedFrom: shop.mergedFrom,
  };
}

/**
 * Normalize all shops in an array
 * @param {Array} shops - Array of shop objects
 * @returns {Array} Normalized shops
 */
export function normalizeShops(shops) {
  console.log(`Normalizing ${shops.length} shops...`);

  const normalized = shops.map(normalizeShop);

  // Count shops with various fields
  const withWebsite = normalized.filter((s) => s.website).length;
  const withPhone = normalized.filter((s) => s.phone).length;
  const withAddress = normalized.filter((s) => s.address).length;

  console.log(`Normalization complete:`);
  console.log(`  - ${withAddress} with address (${Math.round((withAddress / shops.length) * 100)}%)`);
  console.log(`  - ${withWebsite} with website (${Math.round((withWebsite / shops.length) * 100)}%)`);
  console.log(`  - ${withPhone} with phone (${Math.round((withPhone / shops.length) * 100)}%)`);

  return normalized;
}

/**
 * Prepare shops for final output (remove internal metadata)
 * @param {Array} shops - Array of normalized shops
 * @returns {Array} Clean output-ready shops
 */
export function prepareForOutput(shops) {
  return shops.map((shop) => {
    const output = {
      id: shop.id,
      name: shop.name,
      address: shop.address,
      lat: shop.lat,
      lng: shop.lng,
      isIndependent: shop.isIndependent,
    };

    // Only include optional fields if they have values
    if (shop.website) output.website = shop.website;
    if (shop.phone) output.phone = shop.phone;

    return output;
  });
}
