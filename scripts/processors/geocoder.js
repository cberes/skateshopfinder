/**
 * Geocoding processor
 * Validates and enriches coordinate data using Nominatim
 */

import fetch from 'node-fetch';
import { RateLimiter } from '../utils/rate-limiter.js';

// Nominatim rate limit: 1 request per second
const rateLimiter = new RateLimiter(1);

// USA coordinate bounds
const USA_BOUNDS = {
  minLat: 24.5,
  maxLat: 49.5,
  minLng: -125.0,
  maxLng: -66.5,
};

/**
 * Check if coordinates are within USA bounds
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if within USA
 */
export function isWithinUSA(lat, lng) {
  return (
    lat >= USA_BOUNDS.minLat &&
    lat <= USA_BOUNDS.maxLat &&
    lng >= USA_BOUNDS.minLng &&
    lng <= USA_BOUNDS.maxLng
  );
}

/**
 * Reverse geocode coordinates to get address
 * Uses OpenStreetMap Nominatim (free, no API key required)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object|null>} Address data or null
 */
export async function reverseGeocode(lat, lng) {
  await rateLimiter.wait();

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lng.toString());
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'FindSkateshops/1.0 (skateshop directory builder)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      return null;
    }

    return {
      address: data.display_name,
      city:
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.municipality,
      state: data.address?.state,
      postcode: data.address?.postcode,
      country: data.address?.country,
    };
  } catch (error) {
    console.error(`Reverse geocode error for ${lat},${lng}:`, error.message);
    return null;
  }
}

/**
 * Forward geocode address to get coordinates
 * @param {string} address - Address string
 * @returns {Promise<Object|null>} Coordinates or null
 */
export async function forwardGeocode(address) {
  await rateLimiter.wait();

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'json');
    url.searchParams.set('countrycodes', 'us');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'FindSkateshops/1.0 (skateshop directory builder)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.length) {
      return null;
    }

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch (error) {
    console.error(`Forward geocode error for "${address}":`, error.message);
    return null;
  }
}

/**
 * Validate and optionally enrich shop coordinates
 * @param {Object} shop - Shop object
 * @param {Object} options - Options
 * @param {boolean} options.enrichMissingAddress - Fetch address if missing
 * @returns {Promise<Object>} Validated/enriched shop
 */
export async function validateCoordinates(shop, options = {}) {
  const { enrichMissingAddress = false } = options;

  // Check if coordinates exist
  if (shop.lat === null || shop.lng === null) {
    // Try to geocode from address if available
    if (shop.address) {
      const coords = await forwardGeocode(shop.address);
      if (coords) {
        return {
          ...shop,
          lat: coords.lat,
          lng: coords.lng,
          _geocoded: true,
        };
      }
    }
    return { ...shop, _validCoords: false };
  }

  // Validate coordinates are within USA
  if (!isWithinUSA(shop.lat, shop.lng)) {
    return { ...shop, _validCoords: false, _outsideUSA: true };
  }

  // Optionally enrich missing address
  if (enrichMissingAddress && !shop.address) {
    const addressData = await reverseGeocode(shop.lat, shop.lng);
    if (addressData?.address) {
      return {
        ...shop,
        address: formatAddress(addressData),
        _enrichedAddress: true,
        _validCoords: true,
      };
    }
  }

  return { ...shop, _validCoords: true };
}

/**
 * Format address components into string
 * @param {Object} addressData - Address data from reverse geocode
 * @returns {string} Formatted address
 */
function formatAddress(addressData) {
  const parts = [];

  if (addressData.address) {
    // Use display_name but try to simplify it
    const simplified = addressData.address
      .split(',')
      .slice(0, 4)
      .map((p) => p.trim())
      .join(', ');
    return simplified;
  }

  if (addressData.city) parts.push(addressData.city);
  if (addressData.state) parts.push(addressData.state);
  if (addressData.postcode) parts.push(addressData.postcode);

  return parts.join(', ') || null;
}

/**
 * Validate coordinates for all shops
 * Filters out shops with invalid or missing coordinates
 * @param {Array} shops - Array of shop objects
 * @param {Object} options - Options for validation
 * @returns {Promise<Array>} Validated shops
 */
export async function validateAllCoordinates(shops, options = {}) {
  console.log(`Validating coordinates for ${shops.length} shops...`);

  const validated = [];
  let invalidCount = 0;
  let outsideUSACount = 0;
  let geocodedCount = 0;

  for (const shop of shops) {
    const result = await validateCoordinates(shop, options);

    if (result._validCoords === false) {
      invalidCount++;
      if (result._outsideUSA) {
        outsideUSACount++;
      }
      continue;
    }

    if (result._geocoded) {
      geocodedCount++;
    }

    validated.push(result);
  }

  console.log(`Coordinate validation complete:`);
  console.log(`  - ${validated.length} valid shops`);
  console.log(`  - ${invalidCount} removed (${outsideUSACount} outside USA)`);
  if (geocodedCount > 0) {
    console.log(`  - ${geocodedCount} geocoded from address`);
  }

  return validated;
}
