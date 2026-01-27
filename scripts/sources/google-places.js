/**
 * Google Places API integration
 * Fetches skateshop data using Text Search API
 *
 * Requires GOOGLE_PLACES_API_KEY environment variable
 *
 * Pricing: $32 per 1,000 requests (1,000 free/month)
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
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Dallas-Fort Worth', lat: 32.7767, lng: -96.797 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'Washington DC', lat: 38.9072, lng: -77.0369 },
  { name: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
  { name: 'Miami', lat: 25.7617, lng: -80.1918 },
  { name: 'Atlanta', lat: 33.749, lng: -84.388 },
  { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  { name: 'Phoenix', lat: 33.4484, lng: -112.074 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'Riverside', lat: 33.9533, lng: -117.3962 },
  { name: 'Detroit', lat: 42.3314, lng: -83.0458 },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
  { name: 'Minneapolis', lat: 44.9778, lng: -93.265 },
  { name: 'San Diego', lat: 32.7157, lng: -117.1611 },
  { name: 'Tampa', lat: 27.9506, lng: -82.4572 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  { name: 'St. Louis', lat: 38.627, lng: -90.1994 },
  { name: 'Baltimore', lat: 39.2904, lng: -76.6122 },
  { name: 'Orlando', lat: 28.5383, lng: -81.3792 },
  { name: 'Charlotte', lat: 35.2271, lng: -80.8431 },
  { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
  { name: 'Portland', lat: 45.5152, lng: -122.6784 },
  { name: 'Sacramento', lat: 38.5816, lng: -121.4944 },
  { name: 'Pittsburgh', lat: 40.4406, lng: -79.9959 },
  { name: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
  { name: 'Austin', lat: 30.2672, lng: -97.7431 },
  { name: 'Cincinnati', lat: 39.1031, lng: -84.512 },
  { name: 'Kansas City', lat: 39.0997, lng: -94.5786 },
  { name: 'Columbus', lat: 39.9612, lng: -82.9988 },
  { name: 'Indianapolis', lat: 39.7684, lng: -86.1581 },
  { name: 'Cleveland', lat: 41.4993, lng: -81.6944 },
  { name: 'San Jose', lat: 37.3382, lng: -121.8863 },
  { name: 'Nashville', lat: 36.1627, lng: -86.7816 },
  { name: 'Virginia Beach', lat: 36.8529, lng: -75.978 },
  { name: 'Providence', lat: 41.824, lng: -71.4128 },
  { name: 'Milwaukee', lat: 43.0389, lng: -87.9065 },
  { name: 'Jacksonville', lat: 30.3322, lng: -81.6557 },
  { name: 'Oklahoma City', lat: 35.4676, lng: -97.5164 },
  { name: 'Raleigh', lat: 35.7796, lng: -78.6382 },
  { name: 'Memphis', lat: 35.1495, lng: -90.049 },
  { name: 'Richmond', lat: 37.5407, lng: -77.436 },
  { name: 'Louisville', lat: 38.2527, lng: -85.7585 },
  { name: 'New Orleans', lat: 29.9511, lng: -90.0715 },
  { name: 'Salt Lake City', lat: 40.7608, lng: -111.891 },
  { name: 'Hartford', lat: 41.7658, lng: -72.6734 },
  { name: 'Buffalo', lat: 42.8864, lng: -78.8784 },
  { name: 'Birmingham', lat: 33.5207, lng: -86.8025 },

  // Additional metros (51-100)
  { name: 'Rochester NY', lat: 43.1566, lng: -77.6088 },
  { name: 'Grand Rapids', lat: 42.9634, lng: -85.6681 },
  { name: 'Tucson', lat: 32.2226, lng: -110.9747 },
  { name: 'Tulsa', lat: 36.154, lng: -95.9928 },
  { name: 'Fresno', lat: 36.7378, lng: -119.7871 },
  { name: 'Bridgeport CT', lat: 41.1865, lng: -73.1952 },
  { name: 'Worcester MA', lat: 42.2626, lng: -71.8023 },
  { name: 'Albuquerque', lat: 35.0844, lng: -106.6504 },
  { name: 'Omaha', lat: 41.2565, lng: -95.9345 },
  { name: 'Albany NY', lat: 42.6526, lng: -73.7562 },
  { name: 'Bakersfield', lat: 35.3733, lng: -119.0187 },
  { name: 'Knoxville', lat: 35.9606, lng: -83.9207 },
  { name: 'New Haven', lat: 41.3083, lng: -72.9279 },
  { name: 'Greenville SC', lat: 34.8526, lng: -82.394 },
  { name: 'Oxnard', lat: 34.1975, lng: -119.1771 },
  { name: 'El Paso', lat: 31.7619, lng: -106.485 },
  { name: 'Allentown', lat: 40.6084, lng: -75.4902 },
  { name: 'Baton Rouge', lat: 30.4515, lng: -91.1871 },
  { name: 'Dayton', lat: 39.7589, lng: -84.1916 },
  { name: 'McAllen', lat: 26.2034, lng: -98.23 },
  { name: 'Columbia SC', lat: 34.0007, lng: -81.0348 },
  { name: 'Greensboro', lat: 36.0726, lng: -79.792 },
  { name: 'Akron', lat: 41.0814, lng: -81.519 },
  { name: 'Little Rock', lat: 34.7465, lng: -92.2896 },
  { name: 'Stockton', lat: 37.9577, lng: -121.2908 },
  { name: 'Colorado Springs', lat: 38.8339, lng: -104.8214 },
  { name: 'Syracuse', lat: 43.0481, lng: -76.1474 },
  { name: 'Charleston SC', lat: 32.7765, lng: -79.9311 },
  { name: 'Cape Coral', lat: 26.5629, lng: -81.9495 },
  { name: 'Springfield MA', lat: 42.1015, lng: -72.5898 },
  { name: 'Boise', lat: 43.615, lng: -116.2023 },
  { name: 'Wichita', lat: 37.6872, lng: -97.3301 },
  { name: 'Lakeland', lat: 28.0395, lng: -81.9498 },
  { name: 'Madison', lat: 43.0731, lng: -89.4012 },
  { name: 'Ogden', lat: 41.223, lng: -111.9738 },
  { name: 'Winston-Salem', lat: 36.0999, lng: -80.2442 },
  { name: 'Des Moines', lat: 41.5868, lng: -93.625 },
  { name: 'Toledo', lat: 41.6528, lng: -83.5379 },
  { name: 'Durham', lat: 35.994, lng: -78.8986 },
  { name: 'Deltona', lat: 28.9005, lng: -81.2637 },

  // Additional metros (101-150)
  { name: 'Honolulu', lat: 21.3069, lng: -157.8583 },
  { name: 'Provo', lat: 40.2338, lng: -111.6585 },
  { name: 'Jackson MS', lat: 32.2988, lng: -90.1848 },
  { name: 'Harrisburg', lat: 40.2732, lng: -76.8867 },
  { name: 'Spokane', lat: 47.6588, lng: -117.426 },
  { name: 'Chattanooga', lat: 35.0456, lng: -85.3097 },
  { name: 'Scranton', lat: 41.409, lng: -75.6624 },
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
  { name: 'Port St. Lucie', lat: 27.273, lng: -80.3582 },
  { name: 'Mobile', lat: 30.6954, lng: -88.0399 },
  { name: 'Ann Arbor', lat: 42.2808, lng: -83.743 },
  { name: 'Montgomery', lat: 32.3668, lng: -86.3 },
  { name: 'Salinas', lat: 36.6777, lng: -121.6555 },

  // Smaller metros with active skate scenes
  { name: 'Asheville', lat: 35.5951, lng: -82.5515 },
  { name: 'Boulder', lat: 40.015, lng: -105.2705 },
  { name: 'Santa Cruz', lat: 36.9741, lng: -122.0308 },
  { name: 'Burlington VT', lat: 44.4759, lng: -73.2121 },
  { name: 'Eugene', lat: 44.0521, lng: -123.0868 },
  { name: 'Bend', lat: 44.0582, lng: -121.3153 },
  { name: 'Fort Collins', lat: 40.5853, lng: -105.0844 },
  { name: 'Wilmington NC', lat: 34.2257, lng: -77.9447 },
  { name: 'Myrtle Beach', lat: 33.6891, lng: -78.8867 },
  { name: 'Charleston WV', lat: 38.3498, lng: -81.6326 },

  // Additional cities for coverage gaps (151-220)
  // Mountain West
  { name: 'Missoula', lat: 46.8721, lng: -113.994 },
  { name: 'Billings', lat: 45.7833, lng: -108.5007 },
  { name: 'Great Falls', lat: 47.5053, lng: -111.3008 },
  { name: 'Bozeman', lat: 45.677, lng: -111.0429 },
  { name: 'Casper', lat: 42.8666, lng: -106.3131 },
  { name: 'Cheyenne', lat: 41.14, lng: -104.8202 },
  { name: 'Laramie', lat: 41.3114, lng: -105.5911 },
  { name: 'Pocatello', lat: 42.8713, lng: -112.4455 },
  { name: 'Twin Falls', lat: 42.5558, lng: -114.4701 },
  { name: 'Idaho Falls', lat: 43.4917, lng: -112.0339 },
  { name: 'Flagstaff', lat: 35.1983, lng: -111.6513 },
  { name: 'Prescott', lat: 34.54, lng: -112.4685 },
  { name: 'Sierra Vista', lat: 31.5455, lng: -110.2773 },
  { name: 'Durango', lat: 37.2753, lng: -107.8801 },
  { name: 'Grand Junction', lat: 39.0639, lng: -108.5506 },
  { name: 'Pueblo', lat: 38.2544, lng: -104.6091 },
  { name: 'Santa Fe', lat: 35.687, lng: -105.9378 },
  { name: 'Las Cruces', lat: 32.3199, lng: -106.7637 },
  { name: 'Roswell', lat: 33.3943, lng: -104.523 },
  { name: 'St. George UT', lat: 37.0965, lng: -113.5684 },
  { name: 'Logan UT', lat: 41.737, lng: -111.8338 },

  // Pacific Northwest / Northern California
  { name: 'Bellingham', lat: 48.7519, lng: -122.4787 },
  { name: 'Olympia', lat: 47.0379, lng: -122.9007 },
  { name: 'Yakima', lat: 46.6021, lng: -120.5059 },
  { name: 'Tri-Cities WA', lat: 46.2396, lng: -119.2247 },
  { name: 'Medford', lat: 42.3265, lng: -122.8756 },
  { name: 'Salem', lat: 44.9429, lng: -123.0351 },
  { name: 'Redding', lat: 40.5865, lng: -122.3917 },
  { name: 'Chico', lat: 39.7285, lng: -121.8375 },
  { name: 'Eureka', lat: 40.8021, lng: -124.1637 },
  { name: 'Visalia', lat: 36.3302, lng: -119.2921 },
  { name: 'Monterey', lat: 36.6002, lng: -121.8947 },
  { name: 'San Luis Obispo', lat: 35.2828, lng: -120.6596 },

  // Midwest / Great Plains
  { name: 'Fargo', lat: 46.8772, lng: -96.7898 },
  { name: 'Sioux Falls', lat: 43.5446, lng: -96.7311 },
  { name: 'Rapid City', lat: 44.0805, lng: -103.231 },
  { name: 'Bismarck', lat: 46.8083, lng: -100.7837 },
  { name: 'Lincoln', lat: 40.8258, lng: -96.6852 },
  { name: 'Topeka', lat: 39.0489, lng: -95.678 },
  { name: 'Springfield MO', lat: 37.209, lng: -93.2923 },
  { name: 'Columbia MO', lat: 38.9517, lng: -92.3341 },
  { name: 'Cedar Rapids', lat: 41.9779, lng: -91.6656 },
  { name: 'Quad Cities', lat: 41.5236, lng: -90.5776 },
  { name: 'Peoria', lat: 40.6936, lng: -89.589 },
  { name: 'Champaign', lat: 40.1164, lng: -88.2434 },
  { name: 'Bloomington IN', lat: 39.1653, lng: -86.5264 },
  { name: 'South Bend', lat: 41.6764, lng: -86.252 },
  { name: 'Green Bay', lat: 44.5133, lng: -88.0133 },
  { name: 'Duluth', lat: 46.7867, lng: -92.1005 },
  { name: 'Rochester MN', lat: 44.0121, lng: -92.4802 },
  { name: 'La Crosse', lat: 43.8014, lng: -91.2396 },

  // South / Southeast
  { name: 'Shreveport', lat: 32.5252, lng: -93.7502 },
  { name: 'Lafayette LA', lat: 30.2241, lng: -92.0198 },
  { name: 'Lake Charles', lat: 30.2266, lng: -93.2174 },
  { name: 'Biloxi', lat: 30.396, lng: -88.8853 },
  { name: 'Tallahassee', lat: 30.4383, lng: -84.2807 },
  { name: 'Gainesville FL', lat: 29.6516, lng: -82.3248 },
  { name: 'Ocala', lat: 29.1872, lng: -82.1401 },
  { name: 'Panama City', lat: 30.1588, lng: -85.6602 },
  { name: 'Dothan', lat: 31.2232, lng: -85.3905 },
  { name: 'Columbus GA', lat: 32.461, lng: -84.9877 },
  { name: 'Macon', lat: 32.8407, lng: -83.6324 },
  { name: 'Athens GA', lat: 33.9519, lng: -83.3576 },
  { name: 'Florence SC', lat: 34.1954, lng: -79.7626 },
  { name: 'Fayetteville NC', lat: 35.0527, lng: -78.8784 },
  { name: 'Greenville NC', lat: 35.6127, lng: -77.3664 },
  { name: 'Roanoke', lat: 37.271, lng: -79.9414 },
  { name: 'Lynchburg', lat: 37.4138, lng: -79.1422 },
  { name: 'Charlottesville', lat: 38.0293, lng: -78.4767 },
  { name: 'Johnson City TN', lat: 36.3134, lng: -82.3535 },

  // Texas
  { name: 'Lubbock', lat: 33.5779, lng: -101.8552 },
  { name: 'Amarillo', lat: 35.222, lng: -101.8313 },
  { name: 'Midland', lat: 31.9973, lng: -102.0779 },
  { name: 'Abilene', lat: 32.4487, lng: -99.7331 },
  { name: 'Waco', lat: 31.5493, lng: -97.1467 },
  { name: 'Tyler', lat: 32.3513, lng: -95.3011 },
  { name: 'Beaumont', lat: 30.0802, lng: -94.1266 },
  { name: 'College Station', lat: 30.628, lng: -96.3344 },
  { name: 'Laredo', lat: 27.5306, lng: -99.4803 },
  { name: 'Brownsville', lat: 25.9017, lng: -97.4975 },

  // Northeast / New England
  { name: 'Manchester NH', lat: 42.9956, lng: -71.4548 },
  { name: 'Concord NH', lat: 43.2081, lng: -71.5376 },
  { name: 'Bangor', lat: 44.8016, lng: -68.7712 },
  { name: 'Lewiston ME', lat: 44.1004, lng: -70.2148 },
  { name: 'Ithaca', lat: 42.444, lng: -76.5019 },
  { name: 'Binghamton', lat: 42.0987, lng: -75.918 },
  { name: 'Utica', lat: 43.1009, lng: -75.2327 },
  { name: 'Plattsburgh', lat: 44.6995, lng: -73.4529 },
  { name: 'State College', lat: 40.7934, lng: -77.86 },
  { name: 'Erie', lat: 42.1292, lng: -80.0851 },
  { name: 'Wheeling', lat: 40.064, lng: -80.7209 },
];

// Search query to find skateboard shops
// Single specific query - we paginate for depth instead of using multiple queries
const SEARCH_QUERIES = [
  'skateboard shop', // Specific query, reduces ice skating/roller skating false positives
];

/**
 * Search for skateshops in a specific metro area (with pagination)
 * @param {Object} metro - Metro area with name, lat, lng
 * @param {string} query - Search query to use
 * @returns {Promise<{places: Array, apiCalls: number}>} Array of place results and API call count
 */
async function searchMetroArea(metro, query) {
  const allPlaces = [];
  let pageToken = null;
  let pageNum = 0;
  const maxPages = 3; // Google allows max 60 results (3 pages of 20)

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.websiteUri',
    'places.nationalPhoneNumber',
    'places.types',
    'places.businessStatus',
    'nextPageToken',
  ].join(',');

  do {
    await rateLimiter.wait();
    pageNum++;

    const requestBody = {
      textQuery: query,
      locationBias: {
        circle: {
          center: {
            latitude: metro.lat,
            longitude: metro.lng,
          },
          radius: 50000, // ~31 miles (API max is 50,000 meters)
        },
      },
      // Only search in USA
      regionCode: 'US',
    };

    // Add pageToken for subsequent pages
    if (pageToken) {
      requestBody.pageToken = pageToken;
    }

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
      const places = data.places || [];
      allPlaces.push(...places);

      // Get next page token (if any)
      pageToken = data.nextPageToken || null;
    } catch (error) {
      console.error(`  Error searching ${metro.name} (page ${pageNum}):`, error.message);
      break; // Stop pagination on error
    }
  } while (pageToken && pageNum < maxPages);

  return { places: allPlaces, apiCalls: pageNum };
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
  const types = place.types || [];

  // Allowlist logic for skateboard-related businesses
  // - skateboard_shop: always include (it's a shop)
  // - skateboard_park + store type: include (park with attached shop, like Food Court)
  // - skateboard_park alone: exclude (just a public skatepark, no retail)
  const hasSkateboardShop = types.includes('skateboard_shop');
  const hasSkateboardPark = types.includes('skateboard_park');
  const storeTypes = ['store', 'sporting_goods_store', 'retail'];
  const hasStoreType = storeTypes.some((type) => types.includes(type));

  const isDefinitelySkateboard = hasSkateboardShop || (hasSkateboardPark && hasStoreType);

  // Skip places that are clearly not skateshops (unless they have skateboard types)
  const lowerName = name.toLowerCase();
  const skipPatterns = [
    // Fingerboards / toy skateboards
    'fingerboard',
    'finger board',
    'tech deck',
    'mini skate',
    // Ice skating / hockey (common false positives for "skate shop")
    'ice skate',
    'ice rink',
    'skating rink',
    'figure skating',
    'figure skater',
    'hockey',
    'pure hockey',
    'great skate',
    "skater's edge",
    'skaters edge',
    'ice arena',
    'ice center',
    'ice centre',
    'skate sharpening',
    'blade sharpening',
    'skate anytime',
    'synthetic ice',
    'artificial ice',
    // Roller skating (different from skateboarding)
    'roller skate',
    'roller rink',
    'rollerskate',
    'roller derby',
    'roller disco',
    // General sporting goods (don't sell skateboard components)
    'sport authority',
    'sports authority',
    "dick's sporting",
    'dicks sporting',
    'big 5 sporting',
    'academy sports',
    // Hockey/ice skating retailers (no skateboard keyword in name)
    'front row sport',
  ];

  // Only apply filters if this isn't definitively a skateboard business
  if (!isDefinitelySkateboard) {
    // Exclude skateparks without a store (public parks, no retail)
    if (hasSkateboardPark && !hasStoreType) {
      return null;
    }

    if (skipPatterns.some((pattern) => lowerName.includes(pattern))) {
      return null;
    }

    // Skip based on Google Places types that indicate non-skateshops
    const excludedTypes = ['ice_skating_rink', 'skating_rink', 'stadium', 'arena'];

    if (excludedTypes.some((type) => types.includes(type))) {
      return null;
    }
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
// Export for testing
export { transformPlace, US_METRO_AREAS, SEARCH_QUERIES };

export async function fetchFromGooglePlaces(options = {}) {
  const { dryRun = false } = options;

  // Estimate: 1 query per metro, 1-3 pages each (pagination)
  const minRequests = US_METRO_AREAS.length;
  const maxRequests = US_METRO_AREAS.length * 3;

  if (dryRun) {
    console.log(`\nDry run: would search ${US_METRO_AREAS.length} metro areas with pagination`);
    console.log('Query:', SEARCH_QUERIES[0]);
    console.log(`Estimated API requests: ${minRequests}-${maxRequests} (1-3 pages per metro)`);
    console.log('Estimated cost: $0 (within free tier of 1,000/month)');
    return [];
  }

  if (!checkApiKey()) {
    return [];
  }

  console.log(`\nSearching ${US_METRO_AREAS.length} US metro areas with pagination...`);
  console.log('Query:', SEARCH_QUERIES[0]);
  console.log(`Estimated API requests: ${minRequests}-${maxRequests} (1-3 pages per metro)\n`);

  const allShops = [];
  const seenPlaceIds = new Set();
  let metroCount = 0;
  let totalApiCalls = 0;

  for (const metro of US_METRO_AREAS) {
    metroCount++;
    process.stdout.write(
      `\r  [${metroCount}/${US_METRO_AREAS.length}] Searching ${metro.name}...          `
    );

    const { places, apiCalls } = await searchMetroArea(metro, SEARCH_QUERIES[0]);
    totalApiCalls += apiCalls;

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
  console.log(
    `Used ${totalApiCalls} API requests across ${metroCount} metros (free tier: 1,000/month)`
  );

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
    shops.slice(0, 5).forEach((shop) => {
      console.log(`  - ${shop.name} (${shop.address})`);
    });
  }
}

// Allow standalone execution (but not when running tests)
if (process.argv[1]?.endsWith('google-places.js')) {
  main().catch(console.error);
}
