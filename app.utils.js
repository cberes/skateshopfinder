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

/**
 * Filter shops by search term (matches name or address)
 * @param {Array} shops - Array of shop objects
 * @param {string} searchTerm - Search term to filter by
 * @returns {Array} Filtered array of shops
 */
export function filterShopsBySearchTerm(shops, searchTerm) {
    if (!Array.isArray(shops) || !searchTerm) {
        return shops || [];
    }

    const term = searchTerm.toLowerCase().trim();
    if (!term) {
        return shops;
    }

    return shops.filter(shop => {
        const name = (shop.name || '').toLowerCase();
        const address = (shop.address || '').toLowerCase();
        return name.includes(term) || address.includes(term);
    });
}

/**
 * Format shop data for select dropdown display
 * @param {Object} shop - Shop object with name and address
 * @returns {string} Formatted string for display
 */
export function formatShopForSelect(shop) {
    if (!shop) return '';

    const name = shop.name || 'Unknown Shop';
    const address = shop.address || '';

    // Extract city and state from address for brevity
    const cityState = extractCityState(address);

    if (cityState) {
        return `${name} - ${cityState}`;
    }
    return name;
}

/**
 * Extract city and state from a full address
 * @param {string} address - Full address string
 * @returns {string} City, State portion or empty string
 */
export function extractCityState(address) {
    if (!address) return '';

    // Try to match "City, ST ZIP" or "City, ST" pattern
    // e.g., "123 Main St, Los Angeles, CA 90210" -> "Los Angeles, CA"
    const parts = address.split(',').map(p => p.trim());

    if (parts.length >= 2) {
        // Get second-to-last and last parts (usually city and state+zip)
        const cityPart = parts[parts.length - 2];
        const stateZipPart = parts[parts.length - 1];

        // Extract just the state (first 2 characters after trimming, if it looks like a state)
        const stateMatch = stateZipPart.match(/^([A-Z]{2})/);
        if (stateMatch) {
            return `${cityPart}, ${stateMatch[1]}`;
        }
        return `${cityPart}, ${stateZipPart}`;
    }

    return '';
}

/**
 * Create HTML for a map popup
 * @param {Object} shop - Shop object with name, address, distance, website, phone, isIndependent, lat, lng
 * @returns {string} HTML string for the map popup
 */
export function createMapPopupHTML(shop) {
    const distanceDisplay = typeof shop.distance === 'number'
        ? shop.distance.toFixed(1)
        : '?';

    const independentBadge = shop.isIndependent
        ? '<span class="popup-badge-independent">Independent</span>'
        : '';

    const websiteLink = shop.website
        ? `<a href="${escapeHtml(shop.website)}" class="popup-link" target="_blank" rel="noopener noreferrer">Website</a>`
        : '';

    const phoneLink = shop.phone
        ? `<a href="tel:${escapeHtml(shop.phone.replace(/[^0-9+]/g, ''))}" class="popup-link">${escapeHtml(shop.phone)}</a>`
        : '';

    // Build Google Maps directions URL
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop.address || `${shop.lat},${shop.lng}`)}`;

    return `
        <div class="map-popup">
            <div class="popup-header">
                <strong class="popup-name">${escapeHtml(shop.name)}</strong>
                <span class="popup-distance">${distanceDisplay} mi</span>
            </div>
            <p class="popup-address">${escapeHtml(shop.address)}</p>
            <div class="popup-details">
                ${independentBadge}
                ${websiteLink}
                ${phoneLink}
            </div>
            <a href="${escapeHtml(directionsUrl)}" class="popup-directions" target="_blank" rel="noopener noreferrer">Get Directions</a>
        </div>
    `;
}

/**
 * Calculate bounding box for a set of shops
 * @param {Array} shops - Array of shop objects with lat/lng
 * @returns {Object|null} Bounding box { north, south, east, west } or null if no valid shops
 */
export function getMapBounds(shops) {
    if (!Array.isArray(shops) || shops.length === 0) {
        return null;
    }

    // Filter to shops with valid coordinates
    const validShops = shops.filter(shop =>
        shop &&
        typeof shop.lat === 'number' &&
        typeof shop.lng === 'number' &&
        !isNaN(shop.lat) &&
        !isNaN(shop.lng)
    );

    if (validShops.length === 0) {
        return null;
    }

    let north = validShops[0].lat;
    let south = validShops[0].lat;
    let east = validShops[0].lng;
    let west = validShops[0].lng;

    for (const shop of validShops) {
        if (shop.lat > north) north = shop.lat;
        if (shop.lat < south) south = shop.lat;
        if (shop.lng > east) east = shop.lng;
        if (shop.lng < west) west = shop.lng;
    }

    return { north, south, east, west };
}
