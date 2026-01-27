/**
 * Classification processor
 * Determines if a shop is independent or part of a chain
 * Also provides confidence scoring for shop classification
 */

// Store types that indicate a retail location
export const STORE_TYPES = ['store', 'sporting_goods_store', 'retail'];

// Patterns that suggest a skateboard-related shop
export const SKATE_NAME_PATTERNS = [/skate/i, /sk8/i, /board/i, /deck/i, /shred/i, /thrash/i];

// Patterns that indicate non-skateboard businesses to skip
export const SKIP_PATTERNS = [
  'fingerboard',
  'finger board',
  'tech deck',
  'mini skate',
  'miniskate',
  'ice skate',
  'iceskate',
  'ice rink',
  'icerink',
  'skating rink',
  'skatingrink',
  'figure skating',
  'figureskating',
  'figure skater',
  'figureskater',
  'hockey',
  'pure hockey',
  'purehockey',
  'great skate',
  'greatskate',
  "skater's edge",
  'skaters edge',
  'skatersedge',
  'ice arena',
  'icearena',
  'ice center',
  'icecenter',
  'ice centre',
  'icecentre',
  'skate sharpening',
  'skatesharpening',
  'blade sharpening',
  'bladesharpening',
  'skate anytime',
  'skateanytime',
  'synthetic ice',
  'syntheticice',
  'artificial ice',
  'artificialice',
  'roller skate',
  'rollerskate',
  'roller rink',
  'rollerrink',
  'roller derby',
  'rollerderby',
  'roller disco',
  'rollerdisco',
  'sport authority',
  'sports authority',
  'sportsauthority',
  "dick's sporting",
  'dicks sporting',
  'dickssporting',
  'big 5 sporting',
  'big5sporting',
  'academy sports',
  'academysports',
  'front row sport',
  'frontrowsport',
];

// Google Places types to exclude
export const EXCLUDED_TYPES = [
  'ice_skating_rink',
  'skating_rink',
  'stadium',
  'arena',
  'department_store',
];

// Known chain store patterns
const CHAIN_PATTERNS = [
  { pattern: /\bzumiez\b/i, name: 'Zumiez' },
  { pattern: /\bvans\s*(store|outlet)?\b/i, name: 'Vans' },
  { pattern: /\btactics\b/i, name: 'Tactics' },
  { pattern: /\bccs\b/i, name: 'CCS' },
  { pattern: /\btilly'?s\b/i, name: "Tilly's" },
  { pattern: /\bpacsun\b/i, name: 'PacSun' },
  { pattern: /\bactive\s*ride\s*shop\b/i, name: 'Active Ride Shop' },
  { pattern: /\bempire\s*skate\b/i, name: 'Empire' },
  { pattern: /\bskatewarehouse\b/i, name: 'Skate Warehouse' },
];

// Websites that indicate chain stores
const CHAIN_WEBSITES = [
  'zumiez.com',
  'vans.com',
  'tactics.com',
  'ccs.com',
  'tillys.com',
  'pacsun.com',
  'activeridestore.com',
  'skatewarehouse.com',
];

/**
 * Check if shop matches a known skateboard chain
 * @param {Object} shop - Shop object with name and website
 * @returns {Object|null} Chain info or null
 */
function matchKnownChain(shop) {
  // Check name against chain patterns
  if (shop.name) {
    for (const chain of CHAIN_PATTERNS) {
      if (chain.pattern.test(shop.name)) {
        return { chainName: chain.name, matchedBy: 'name' };
      }
    }
  }

  // Check website against chain domains
  if (shop.website) {
    try {
      const url = new URL(shop.website);
      const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
      for (const chainDomain of CHAIN_WEBSITES) {
        if (hostname === chainDomain || hostname.endsWith(`.${chainDomain}`)) {
          return { chainName: chainDomain.split('.')[0], matchedBy: 'website' };
        }
      }
    } catch {
      // Invalid URL, ignore
    }
  }

  return null;
}

/**
 * Calculate confidence level for a shop being a skateboard shop
 * @param {Object} shop - Shop object with name and types
 * @returns {Object} Confidence result with level and reason
 */
export function calculateConfidence(shop) {
  const types = shop.types || [];
  const name = (shop.name || '').toLowerCase();

  // Check for known skateboard chain stores (Zumiez, Tactics, etc.)
  const chainMatch = matchKnownChain(shop);
  if (chainMatch) {
    return { level: 'high', reason: `Known chain: ${chainMatch.chainName}` };
  }

  // Check for explicit skateboard shop type
  if (types.includes('skateboard_shop')) {
    return { level: 'high', reason: 'Has skateboard_shop type' };
  }

  // Check for skate park with store
  const hasStoreType = STORE_TYPES.some((t) => types.includes(t));
  if (types.includes('skateboard_park') && hasStoreType) {
    return { level: 'very_high', reason: 'Skate park with store' };
  }

  // Check for skate-related name
  const hasSkateNamePattern = SKATE_NAME_PATTERNS.some((p) => p.test(name));
  if (hasStoreType && hasSkateNamePattern) {
    // But exclude if it matches skip patterns
    if (SKIP_PATTERNS.some((p) => name.includes(p))) {
      return { level: 'exclude', reason: 'Name matches skip pattern' };
    }
    return { level: 'good', reason: 'Store with skate-related name' };
  }

  // Check for skate-related website domain (e.g., recskate.com, upriseskateshop.com)
  if (hasStoreType && shop.website) {
    try {
      const url = new URL(shop.website);
      const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
      if (SKATE_NAME_PATTERNS.some((p) => p.test(hostname))) {
        // But exclude if hostname matches skip patterns
        if (SKIP_PATTERNS.some((p) => hostname.includes(p))) {
          return { level: 'exclude', reason: 'Website matches skip pattern' };
        }
        return { level: 'good', reason: 'Store with skate-related website' };
      }
    } catch {
      // Invalid URL, continue to other checks
    }
  }

  // Check for excluded types
  if (EXCLUDED_TYPES.some((t) => types.includes(t))) {
    return { level: 'exclude', reason: 'Has excluded type' };
  }

  // Check for skip patterns in name
  if (SKIP_PATTERNS.some((p) => name.includes(p))) {
    return { level: 'exclude', reason: 'Name matches skip pattern' };
  }

  // Has store type but uncertain
  if (hasStoreType) {
    return { level: 'review', reason: 'Store type but no clear skateboard indicator' };
  }

  // No store type at all - exclude
  return { level: 'exclude', reason: 'No store type' };
}

/**
 * Check if shop name matches a known chain pattern
 * @param {string} name - Shop name
 * @returns {Object|null} Chain info or null
 */
function matchChainByName(name) {
  if (!name) return null;

  for (const chain of CHAIN_PATTERNS) {
    if (chain.pattern.test(name)) {
      return { chainName: chain.name, matchedBy: 'name' };
    }
  }

  return null;
}

/**
 * Check if shop website matches a known chain
 * @param {string} website - Shop website URL
 * @returns {Object|null} Chain info or null
 */
function matchChainByWebsite(website) {
  if (!website) return null;

  try {
    const url = new URL(website);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();

    for (const chainDomain of CHAIN_WEBSITES) {
      if (hostname === chainDomain || hostname.endsWith(`.${chainDomain}`)) {
        return {
          chainName: chainDomain.split('.')[0],
          matchedBy: 'website',
        };
      }
    }
  } catch {
    // Invalid URL, ignore
  }

  return null;
}

/**
 * Classify a single shop as independent or chain
 * @param {Object} shop - Shop object
 * @returns {Object} Shop with isIndependent and chainName fields
 */
export function classifyShop(shop) {
  // If already classified from source data, keep it
  if (shop.isIndependent === false || shop.chainName) {
    return {
      ...shop,
      isIndependent: false,
      chainName: shop.chainName || 'Unknown Chain',
    };
  }

  // Check name patterns
  const nameMatch = matchChainByName(shop.name);
  if (nameMatch) {
    return {
      ...shop,
      isIndependent: false,
      chainName: nameMatch.chainName,
    };
  }

  // Check website
  const websiteMatch = matchChainByWebsite(shop.website);
  if (websiteMatch) {
    return {
      ...shop,
      isIndependent: false,
      chainName: websiteMatch.chainName,
    };
  }

  // Default to independent
  return {
    ...shop,
    isIndependent: true,
  };
}

/**
 * Classify all shops in an array
 * @param {Array} shops - Array of shop objects
 * @returns {Array} Classified shops
 */
export function classifyShops(shops) {
  console.log(`Classifying ${shops.length} shops...`);

  const classified = shops.map(classifyShop);

  const independentCount = classified.filter((s) => s.isIndependent).length;
  const chainCount = classified.filter((s) => !s.isIndependent).length;

  console.log(
    `Classification complete: ${independentCount} independent, ${chainCount} chain stores`
  );

  return classified;
}

/**
 * Detect potential chains by finding shops with similar names in different locations
 * This helps identify chains that aren't in our predefined list
 * @param {Array} shops - Array of shop objects
 * @returns {Array} Potential new chains
 */
export function detectPotentialChains(shops) {
  const nameCount = {};

  for (const shop of shops) {
    if (!shop.name) continue;

    // Normalize name for comparison
    const normalized = shop.name
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!nameCount[normalized]) {
      nameCount[normalized] = [];
    }
    nameCount[normalized].push(shop);
  }

  // Find names that appear multiple times in different cities
  const potentialChains = [];

  for (const [name, locations] of Object.entries(nameCount)) {
    if (locations.length >= 2) {
      // Check if they're in different cities (not just duplicates)
      const cities = new Set(
        locations
          .map((l) => {
            const match = l.address?.match(/,\s*([^,]+),\s*[A-Z]{2}\b/i);
            return match ? match[1].toLowerCase().trim() : null;
          })
          .filter(Boolean)
      );

      if (cities.size >= 2) {
        potentialChains.push({
          name,
          locationCount: locations.length,
          cities: Array.from(cities),
        });
      }
    }
  }

  return potentialChains.sort((a, b) => b.locationCount - a.locationCount);
}
