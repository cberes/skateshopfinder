/**
 * USA Skateshop Finder
 * Main application JavaScript
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        MAX_RESULTS: 20,
        MAX_DISTANCE_MILES: 100,
        EARTH_RADIUS_MILES: 3959,
        DATA_FILE: 'shops.json'
    };

    // DOM Elements
    const elements = {
        searchForm: document.getElementById('search-form'),
        addressInput: document.getElementById('address-input'),
        searchBtn: document.getElementById('search-btn'),
        geolocationBtn: document.getElementById('geolocation-btn'),
        errorMessage: document.getElementById('error-message'),
        loadingIndicator: document.getElementById('loading-indicator'),
        resultsSection: document.getElementById('results-section'),
        resultsSummary: document.getElementById('results-summary'),
        resultsList: document.getElementById('results-list'),
        noResults: document.getElementById('no-results'),
        lastUpdated: document.getElementById('last-updated')
    };

    // Application State
    let shopsData = null;

    /**
     * Initialize the application
     */
    async function init() {
        try {
            await loadShopsData();
            setupEventListeners();
        } catch (error) {
            showError('Failed to load shop data. Please refresh the page.');
            console.error('Initialization error:', error);
        }
    }

    /**
     * Load shops data from JSON file
     */
    async function loadShopsData() {
        const response = await fetch(CONFIG.DATA_FILE);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        shopsData = await response.json();

        // Update last updated date in footer
        if (shopsData.lastUpdated) {
            elements.lastUpdated.textContent = shopsData.lastUpdated;
        }
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        elements.searchForm.addEventListener('submit', handleSearch);
        elements.geolocationBtn.addEventListener('click', handleGeolocation);
    }

    /**
     * Handle search form submission
     */
    async function handleSearch(event) {
        event.preventDefault();

        const address = elements.addressInput.value.trim();
        if (!address) {
            showError('Please enter an address or ZIP code.');
            return;
        }

        showLoading();
        hideError();

        try {
            const coordinates = await geocodeAddress(address);
            if (coordinates) {
                findNearbyShops(coordinates.lat, coordinates.lng);
            }
        } catch (error) {
            showError('Could not find that location. Please try a different address.');
            console.error('Geocoding error:', error);
        } finally {
            hideLoading();
        }
    }

    /**
     * Handle geolocation button click
     */
    function handleGeolocation() {
        if (!navigator.geolocation) {
            showError('Geolocation is not supported by your browser.');
            return;
        }

        showLoading();
        hideError();

        navigator.geolocation.getCurrentPosition(
            (position) => {
                hideLoading();
                findNearbyShops(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                hideLoading();
                let message = 'Could not get your location.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location access denied. Please enable location permissions or enter an address.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location information unavailable. Please try entering an address.';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out. Please try again.';
                        break;
                }
                showError(message);
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );
    }

    /**
     * Geocode an address to coordinates using Nominatim
     * Note: For production, consider rate limiting and caching
     */
    async function geocodeAddress(address) {
        const encodedAddress = encodeURIComponent(address + ', USA');
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=us`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'USASkateshopFinder/1.0'
            }
        });

        if (!response.ok) {
            throw new Error('Geocoding request failed');
        }

        const data = await response.json();

        if (data.length === 0) {
            throw new Error('No results found');
        }

        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
        };
    }

    /**
     * Find shops near the given coordinates
     */
    function findNearbyShops(lat, lng) {
        if (!shopsData || !shopsData.shops) {
            showError('Shop data not available. Please refresh the page.');
            return;
        }

        // Calculate distance to each shop
        const shopsWithDistance = shopsData.shops.map(shop => ({
            ...shop,
            distance: calculateDistance(lat, lng, shop.lat, shop.lng)
        }));

        // Filter by max distance and sort by distance
        const nearbyShops = shopsWithDistance
            .filter(shop => shop.distance <= CONFIG.MAX_DISTANCE_MILES)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, CONFIG.MAX_RESULTS);

        displayResults(nearbyShops);
    }

    /**
     * Calculate distance between two points using Haversine formula
     * @returns Distance in miles
     */
    function calculateDistance(lat1, lng1, lat2, lng2) {
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
     * Display search results
     */
    function displayResults(shops) {
        elements.noResults.hidden = true;
        elements.resultsSection.hidden = true;
        elements.resultsList.innerHTML = '';

        if (shops.length === 0) {
            elements.noResults.hidden = false;
            return;
        }

        // Update summary
        const furthest = shops[shops.length - 1].distance.toFixed(1);
        elements.resultsSummary.textContent =
            `Showing ${shops.length} shop${shops.length !== 1 ? 's' : ''} within ${furthest} miles`;

        // Create shop cards
        shops.forEach(shop => {
            const li = document.createElement('li');
            li.className = 'shop-card';
            li.innerHTML = createShopCardHTML(shop);
            elements.resultsList.appendChild(li);
        });

        elements.resultsSection.hidden = false;
        elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Create HTML for a shop card
     */
    function createShopCardHTML(shop) {
        const websiteLink = shop.website
            ? `<a href="${escapeHtml(shop.website)}" class="shop-link" target="_blank" rel="noopener noreferrer">Visit Website</a>`
            : '';

        const phoneDisplay = shop.phone
            ? `<span class="shop-phone">${escapeHtml(shop.phone)}</span>`
            : '';

        const independentBadge = shop.isIndependent
            ? '<span class="badge-independent">Independent</span>'
            : '';

        return `
            <div class="shop-header">
                <h3 class="shop-name">${escapeHtml(shop.name)}</h3>
                <span class="shop-distance">${shop.distance.toFixed(1)} mi</span>
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
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show error message
     */
    function showError(message) {
        elements.errorMessage.textContent = message;
        elements.errorMessage.hidden = false;
    }

    /**
     * Hide error message
     */
    function hideError() {
        elements.errorMessage.hidden = true;
    }

    /**
     * Show loading indicator
     */
    function showLoading() {
        elements.loadingIndicator.hidden = false;
        elements.searchBtn.disabled = true;
        elements.geolocationBtn.disabled = true;
    }

    /**
     * Hide loading indicator
     */
    function hideLoading() {
        elements.loadingIndicator.hidden = true;
        elements.searchBtn.disabled = false;
        elements.geolocationBtn.disabled = false;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
