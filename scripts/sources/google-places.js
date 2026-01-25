/**
 * Google Places API integration
 * Fetches skateshop data using Text Search API
 *
 * Requires GOOGLE_PLACES_API_KEY environment variable
 *
 * Pricing: $32 per 1,000 requests (5,000 free/month)
 * Strategy: Search "skate shop" in major US metro areas
 */

import fetch from 'node-fetch';
import { RateLimiter } from '../utils/rate-limiter.js';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

// Rate limit: 10 requests per second (Google allows more, but be conservative)
const rateLimiter = new RateLimiter(10);

// Major US metro areas with approximate center coordinates
// Covers ~80% of US population and likely 95%+ of skateshops
const US_METRO_AREAS = [
  // Top 50 metros by population
  { name: 'New York', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Dallas-Fort Worth', lat: 32.7767, lng: -96.7970 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'Washington DC', lat: 38.9072, lng: -77.0369 },
  { name: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
  { name: 'Miami', lat: 25.7617, lng: -80.1918 },
  { name: 'Atlanta', lat: 33.7490, lng: -84.3880 },
  { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'Riverside', lat: 33.9533, lng: -117.3962 },
  { name: 'Detroit', lat: 42.3314, lng: -83.0458 },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
  { name: 'Minneapolis', lat: 44.9778, lng: -93.2650 },
  { name: 'San Diego', lat: 32.7157, lng: -117.1611 },
  { name: 'Tampa', lat: 27.9506, lng: -82.4572 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  { name: 'St. Louis', lat: 38.6270, lng: -90.1994 },
  { name: 'Baltimore', lat: 39.2904, lng: -76.6122 },
  { name: 'Orlando', lat: 28.5383, lng: -81.3792 },
  { name: 'Charlotte', lat: 35.2271, lng: -80.8431 },
  { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
  { name: 'Portland', lat: 45.5152, lng: -122.6784 },
  { name: 'Sacramento', lat: 38.5816, lng: -121.4944 },
  { name: 'Pittsburgh', lat: 40.4406, lng: -79.9959 },
  { name: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
  { name: 'Austin', lat: 30.2672, lng: -97.7431 },
  { name: 'Cincinnati', lat: 39.1031, lng: -84.5120 },
  { name: 'Kansas City', lat: 39.0997, lng: -94.5786 },
  { name: 'Columbus', lat: 39.9612, lng: -82.9988 },
  { name: 'Indianapolis', lat: 39.7684, lng: -86.1581 },
  { name: 'Cleveland', lat: 41.4993, lng: -81.6944 },
  { name: 'San Jose', lat: 37.3382, lng: -121.8863 },
  { name: 'Nashville', lat: 36.1627, lng: -86.7816 },
  { name: 'Virginia Beach', lat: 36.8529, lng: -75.9780 },
  { name: 'Providence', lat: 41.8240, lng: -71.4128 },
  { name: 'Milwaukee', lat: 43.0389, lng: -87.9065 },
  { name: 'Jacksonville', lat: 30.3322, lng: -81.6557 },
  { name: 'Oklahoma City', lat: 35.4676, lng: -97.5164 },
  { name: 'Raleigh', lat: 35.7796, lng: -78.6382 },
  { name: 'Memphis', lat: 35.1495, lng: -90.0490 },
  { name: 'Richmond', lat: 37.5407, lng: -77.4360 },
  { name: 'Louisville', lat: 38.2527, lng: -85.7585 },
  { name: 'New Orleans', lat: 29.9511, lng: -90.0715 },
  { name: 'Salt Lake City', lat: 40.7608, lng: -111.8910 },
  { name: 'Hartford', lat: 41.7658, lng: -72.6734 },
  { name: 'Buffalo', lat: 42.8864, lng: -78.8784 },
  { name: 'Birmingham', lat: 33.5207, lng: -86.8025 },

  // Additional metros (51-100)
  { name: 'Rochester NY', lat: 43.1566, lng: -77.6088 },
  { name: 'Grand Rapids', lat: 42.9634, lng: -85.6681 },
  { name: 'Tucson', lat: 32.2226, lng: -110.9747 },
  { name: 'Tulsa', lat: 36.1540, lng: -95.9928 },
  { name: 'Fresno', lat: 36.7378, lng: -119.7871 },
  { name: 'Bridgeport CT', lat: 41.1865, lng: -73.1952 },
  { name: 'Worcester MA', lat: 42.2626, lng: -71.8023 },
  { name: 'Albuquerque', lat: 35.0844, lng: -106.6504 },
  { name: 'Omaha', lat: 41.2565, lng: -95.9345 },
  { name: 'Albany NY', lat: 42.6526, lng: -73.7562 },
  { name: 'Bakersfield', lat: 35.3733, lng: -119.0187 },
  { name: 'Knoxville', lat: 35.9606, lng: -83.9207 },
  { name: 'New Haven', lat: 41.3083, lng: -72.9279 },
  { name: 'Greenville SC', lat: 34.8526, lng: -82.3940 },
  { name: 'Oxnard', lat: 34.1975, lng: -119.1771 },
  { name: 'El Paso', lat: 31.7619, lng: -106.4850 },
  { name: 'Allentown', lat: 40.6084, lng: -75.4902 },
  { name: 'Baton Rouge', lat: 30.4515, lng: -91.1871 },
  { name: 'Dayton', lat: 39.7589, lng: -84.1916 },
  { name: 'McAllen', lat: 26.2034, lng: -98.2300 },
  { name: 'Columbia SC', lat: 34.0007, lng: -81.0348 },
  { name: 'Greensboro', lat: 36.0726, lng: -79.7920 },
  { name: 'Akron', lat: 41.0814, lng: -81.5190 },
  { name: 'Little Rock', lat: 34.7465, lng: -92.2896 },
  { name: 'Stockton', lat: 37.9577, lng: -121.2908 },
  { name: 'Colorado Springs', lat: 38.8339, lng: -104.8214 },
  { name: 'Syracuse', lat: 43.0481, lng: -76.1474 },
  { name: 'Charleston SC', lat: 32.7765, lng: -79.9311 },
  { name: 'Cape Coral', lat: 26.5629, lng: -81.9495 },
  { name: 'Springfield MA', lat: 42.1015, lng: -72.5898 },
  { name: 'Boise', lat: 43.6150, lng: -116.2023 },
  { name: 'Wichita', lat: 37.6872, lng: -97.3301 },
  { name: 'Lakeland', lat: 28.0395, lng: -81.9498 },
  { name: 'Madison', lat: 43.0731, lng: -89.4012 },
  { name: 'Ogden', lat: 41.2230, lng: -111.9738 },
  { name: 'Winston-Salem', lat: 36.0999, lng: -80.2442 },
  { name: 'Des Moines', lat: 41.5868, lng: -93.6250 },
  { name: 'Toledo', lat: 41.6528, lng: -83.5379 },
  { name: 'Durham', lat: 35.9940, lng: -78.8986 },
  { name: 'Deltona', lat: 28.9005, lng: -81.2637 },

  // Additional metros (101-150)
  { name: 'Honolulu', lat: 21.3069, lng: -157.8583 },
  { name: 'Provo', lat: 40.2338, lng: -111.6585 },
  { name: 'Jackson MS', lat: 32.2988, lng: -90.1848 },
  { name: 'Harrisburg', lat: 40.2732, lng: -76.8867 },
  { name: 'Spokane', lat: 47.6588, lng: -117.4260 },
  { name: 'Chattanooga', lat: 35.0456, lng: -85.3097 },
  { name: 'Scranton', lat: 41.4090, lng: -75.6624 },
  { name: 'Modesto', lat: 37.6391, lng: -120.9969 },
  { name: 'Fayetteville AR', lat: 36.0626, lng: -94.1574 },
  { name: 'Youngstown', lat: 41.0998, lng: -80.6495 },
  { name: 'Lansing', lat: 42.7325, lng: -84.5555 },
  { name: 'Lancaster PA', lat: 40.0379, lng: -76.3055 },
  { name: 'Augusta GA', lat: 33.4735, lng: -82.0105 },
  { name: 'Portland ME', lat: 43.6591, lng: -70.2568 },
  { name: 'Santa Rosa', lat: 38.4405, lng: -122.7144 },
  { name: 'Lexington', lat: 38.0406, lng: -84.5037 },
  { name: 'Palm Bay', lat: 28.0345, lng: -80.5887 },
  { name: 'Corpus Christi', lat: 27.8006, lng: -97.3964 },
  { name: 'Fort Wayne', lat: 41.0793, lng: -85.1394 },
  { name: 'Pensacola', lat: 30.4213, lng: -87.2169 },
  { name: 'Reno', lat: 39.5296, lng: -119.8138 },
  { name: 'Santa Barbara', lat: 34.4208, lng: -119.6982 },
  { name: 'Anchorage', lat: 61.2181, lng: -149.9003 },
  { name: 'Savannah', lat: 32.0809, lng: -81.0912 },
  { name: 'Huntsville', lat: 34.7304, lng: -86.5861 },
  { name: 'Port St. Lucie', lat: 27.2730, lng: -80.3582 },
  { name: 'Mobile', lat: 30.6954, lng: -88.0399 },
  { name: 'Ann Arbor', lat: 42.2808, lng: -83.7430 },
  { name: 'Montgomery', lat: 32.3668, lng: -86.3000 },
  { name: 'Salinas', lat: 36.6777, lng: -121.6555 },

  // Smaller metros with active skate scenes
  { name: 'Asheville', lat: 35.5951, lng: -82.5515 },
  { name: 'Boulder', lat: 40.0150, lng: -105.2705 },
  { name: 'Santa Cruz', lat: 36.9741, lng: -122.0308 },
  { name: 'Burlington VT', lat: 44.4759, lng: -73.2121 },
  { name: 'Eugene', lat: 44.0521, lng: -123.0868 },
  { name: 'Bend', lat: 44.0582, lng: -121.3153 },
  { name: 'Fort Collins', lat: 40.5853, lng: -105.0844 },
  { name: 'Wilmington NC', lat: 34.2257, lng: -77.9447 },
  { name: 'Myrtle Beach', lat: 33.6891, lng: -78.8867 },
  { name: 'Charleston WV', lat: 38.3498, lng: -81.6326 },
];

/**
 * Search for skateshops in a specific metro area
 * @param {Object} metro - Metro area with name, lat, lng
 * @returns {Promise<Array>} Array of place results
 */
async function searchMetroArea(metro) {
  await rateLimiter.wait();

  const requestBody = {
    textQuery: 'skate shop',
    locationBias: {
      circle: {
        center: {
          latitude: metro.lat,
          longitude: metro.lng,
        },
        radius: 80467.2, // 50 miles in meters
      },
    },
    // Only search in USA
    regionCode: 'US',
    // Request fields we need (affects pricing tier)
    // Using "Basic" tier fields to minimize cost
  };

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.websiteUri',
    'places.nationalPhoneNumber',
    'places.types',
    'places.businessStatus',
  ].join(',');

  try {
    const response = await fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.places || [];
  } catch (error) {
    console.error(`  Error searching ${metro.name}:`, error.message);
    return [];
  }
}

/**
 * Transform Google Places result to shop object
 * @param {Object} place - Google Places result
 * @returns {Object|null} Shop object or null if invalid
 */
function transformPlace(place) {
  // Skip if not operational
  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') {
    return null;
  }

  const location = place.location;
  if (!location || !location.latitude || !location.longitude) {
    return null;
  }

  const name = place.displayName?.text || 'Unknown';

  // Skip places that are clearly not skateshops
  const lowerName = name.toLowerCase();
  const skipPatterns = [
    'fingerboard',
    'finger board',
    'tech deck',
    'mini skate',
    'ice skate',
    'ice rink',
    'roller skate',
    'roller rink',
    'skating rink',
    'figure skating',
  ];

  if (skipPatterns.some(pattern => lowerName.includes(pattern))) {
    return null;
  }

  return {
    id: `google-${place.id}`,
    name: name,
    address: place.formattedAddress || null,
    lat: location.latitude,
    lng: location.longitude,
    website: place.websiteUri || null,
    phone: place.nationalPhoneNumber || null,
    source: 'google-places',
    googlePlaceId: place.id,
    types: place.types || [],
  };
}

/**
 * Check if API key is configured
 */
function checkApiKey() {
  if (!API_KEY) {
    console.error('\n❌ GOOGLE_PLACES_API_KEY environment variable is not set');
    console.error('\nTo use Google Places API:');
    console.error('1. Go to https://console.cloud.google.com/');
    console.error('2. Create a project and enable Places API');
    console.error('3. Create an API key');
    console.error('4. Run: export GOOGLE_PLACES_API_KEY=your_key_here');
    console.error('5. Then run this script again\n');
    return false;
  }
  return true;
}

/**
 * Fetch skateshops from Google Places API
 * @param {Object} options - Options
 * @param {boolean} options.dryRun - If true, just show what would be searched
 * @returns {Promise<Array>} Array of shop objects
 */
export async function fetchFromGooglePlaces(options = {}) {
  const { dryRun = false } = options;

  if (dryRun) {
    console.log(`\nDry run: would search ${US_METRO_AREAS.length} metro areas`);
    console.log('Estimated API requests:', US_METRO_AREAS.length);
    console.log('Estimated cost: $0 (within free tier of 5,000/month)');
    return [];
  }

  if (!checkApiKey()) {
    return [];
  }

  console.log(`\nSearching ${US_METRO_AREAS.length} US metro areas...`);
  console.log('This will use approximately', US_METRO_AREAS.length, 'API requests\n');

  const allShops = [];
  const seenPlaceIds = new Set();
  let searchCount = 0;

  for (const metro of US_METRO_AREAS) {
    searchCount++;
    process.stdout.write(`\r  [${searchCount}/${US_METRO_AREAS.length}] Searching ${metro.name}...          `);

    const places = await searchMetroArea(metro);

    for (const place of places) {
      // Skip duplicates (same shop might appear in multiple metro searches)
      if (seenPlaceIds.has(place.id)) {
        continue;
      }
      seenPlaceIds.add(place.id);

      const shop = transformPlace(place);
      if (shop) {
        allShops.push(shop);
      }
    }
  }

  console.log(`\n\nFound ${allShops.length} unique skateshops`);
  console.log(`Used ${searchCount} API requests (free tier: 5,000/month)`);

  return allShops;
}

/**
 * Standalone execution for testing
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('=== Google Places API Collection ===');

  const shops = await fetchFromGooglePlaces({ dryRun });

  if (!dryRun && shops.length > 0) {
    console.log('\nSample results:');
    shops.slice(0, 5).forEach(shop => {
      console.log(`  - ${shop.name} (${shop.address})`);
    });
  }
}

// Allow standalone execution
if (process.argv[1]?.includes('google-places')) {
  main().catch(console.error);
}
