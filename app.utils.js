/**
 * USA Skateshop Finder - Utility Functions
 * Pure functions for testing and reuse
 */

// Configuration constants
export const CONFIG = {
    MAX_RESULTS: 20,
    MAX_DISTANCE_MILES: 100,
    EARTH_RADIUS_MILES: 3959,
    DATA_FILE: 'shops.json'
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in miles
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return CONFIG.EARTH_RADIUS_MILES * c;
}

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(text) {
    if (text === null || text === undefined) {
        return '';
    }
    const str = String(text);
    const htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

/**
 * Create HTML for a shop card
 * @param {Object} shop - Shop object with name, address, distance, website, phone, isIndependent
 * @returns {string} HTML string for the shop card
 */
export function createShopCardHTML(shop) {
    const websiteLink = shop.website
        ? `<a href="${escapeHtml(shop.website)}" class="shop-link" target="_blank" rel="noopener noreferrer">Visit Website</a>`
        : '';

    const phoneDisplay = shop.phone
        ? `<span class="shop-phone">${escapeHtml(shop.phone)}</span>`
        : '';

    const independentBadge = shop.isIndependent
        ? '<span class="badge-independent">Independent</span>'
        : '';

    const distanceDisplay = typeof shop.distance === 'number'
        ? shop.distance.toFixed(1)
        : '?';

    return `
        <div class="shop-header">
            <h3 class="shop-name">${escapeHtml(shop.name)}</h3>
            <span class="shop-distance">${distanceDisplay} mi</span>
        </div>
        <p class="shop-address">${escapeHtml(shop.address)}</p>
        <div class="shop-details">
            ${independentBadge}
            ${websiteLink}
            ${phoneDisplay}
        </div>
    `;
}

/**
 * Filter and sort shops by distance from a location
 * @param {Array} shops - Array of shop objects with lat/lng
 * @param {number} userLat - User's latitude
 * @param {number} userLng - User's longitude
 * @param {number} maxDistance - Maximum distance in miles (default: CONFIG.MAX_DISTANCE_MILES)
 * @param {number} maxResults - Maximum number of results (default: CONFIG.MAX_RESULTS)
 * @returns {Array} Filtered and sorted array of shops with distance property
 */
export function filterAndSortShops(shops, userLat, userLng, maxDistance = CONFIG.MAX_DISTANCE_MILES, maxResults = CONFIG.MAX_RESULTS) {
    if (!Array.isArray(shops)) {
        return [];
    }

    // Calculate distance to each shop
    const shopsWithDistance = shops
        .filter(shop =>
            shop &&
            typeof shop.lat === 'number' &&
            typeof shop.lng === 'number' &&
            !isNaN(shop.lat) &&
            !isNaN(shop.lng)
        )
        .map(shop => ({
            ...shop,
            distance: calculateDistance(userLat, userLng, shop.lat, shop.lng)
        }));

    // Filter by max distance, sort by distance, limit results
    return shopsWithDistance
        .filter(shop => shop.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxResults);
}

/**
 * Generate results summary text
 * @param {Array} shops - Array of shops with distance property
 * @returns {string} Summary text
 */
export function generateResultsSummary(shops) {
    if (!shops || shops.length === 0) {
        return '';
    }
    const furthest = shops[shops.length - 1].distance.toFixed(1);
    return `Showing ${shops.length} shop${shops.length !== 1 ? 's' : ''} within ${furthest} miles`;
}

/**
 * Validate coordinates are within valid ranges
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if coordinates are valid
 */
export function isValidCoordinates(lat, lng) {
    return (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
}
