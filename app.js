/**
 * USA Skateshop Finder
 * Main application JavaScript
 */

import {
    CONFIG,
    calculateDistance,
    escapeHtml,
    createShopCardHTML,
    filterAndSortShops,
    generateResultsSummary,
    filterShopsBySearchTerm,
    formatShopForSelect,
    createMapPopupHTML,
    getMapBounds
} from './app.utils.js';

import {
    initAnalytics,
    trackSearch,
    trackGeolocation,
    trackShopClick,
    trackViewChange,
    trackFormSubmission,
    trackFormOpen,
    trackError,
    trackViewResults
} from './analytics.js';

(function() {
    'use strict';

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
        lastUpdated: document.getElementById('last-updated'),
        // Modal elements
        suggestModal: document.getElementById('suggest-modal'),
        reportModal: document.getElementById('report-modal'),
        suggestForm: document.getElementById('suggest-form'),
        reportForm: document.getElementById('report-form'),
        suggestSuccess: document.getElementById('suggest-success'),
        reportSuccess: document.getElementById('report-success'),
        reportShopSelect: document.getElementById('report-shop'),
        reportShopSearch: document.getElementById('report-shop-search'),
        // Map view elements
        listViewBtn: document.getElementById('list-view-btn'),
        mapViewBtn: document.getElementById('map-view-btn'),
        resultsMap: document.getElementById('results-map')
    };

    // Application State
    let shopsData = null;
    let map = null;
    let markersLayer = null;
    let currentView = 'list';
    let currentShops = [];
    let lastUserLat = null;
    let lastUserLng = null;

    /**
     * Initialize the application
     */
    async function init() {
        initAnalytics('G-6RRXJT4DE3');

        try {
            await loadShopsData();
            setupEventListeners();
        } catch (error) {
            showError('Failed to load shop data. Please refresh the page.');
            trackError('init_failed', error.message);
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

        // Modal triggers
        document.querySelectorAll('[data-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.getAttribute('data-modal');
                openModal(document.getElementById(modalId));
            });
        });

        // Modal close buttons and backdrop
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                closeModal(modal);
            });
        });

        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                closeModal(modal);
            });
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal:not([hidden])');
                if (openModal) {
                    closeModal(openModal);
                }
            }
        });

        // Form submissions
        elements.suggestForm.addEventListener('submit', handleSuggestSubmit);
        elements.reportForm.addEventListener('submit', handleReportSubmit);

        // Shop search filter for report form
        elements.reportShopSearch.addEventListener('input', handleShopSearch);

        // View toggle buttons
        elements.listViewBtn.addEventListener('click', () => switchView('list'));
        elements.mapViewBtn.addEventListener('click', () => switchView('map'));

        // Shop click tracking via event delegation
        elements.resultsList.addEventListener('click', handleShopLinkClick);
    }

    /**
     * Handle shop link clicks for analytics tracking
     */
    function handleShopLinkClick(event) {
        const link = event.target.closest('a');
        if (!link) return;

        const shopCard = link.closest('.shop-card');
        if (!shopCard) return;

        const shopName = shopCard.dataset.shopName || 'Unknown';
        const isIndependent = shopCard.dataset.isIndependent === 'true';

        // Determine action type based on link href
        const href = link.href || '';
        let action = 'unknown';

        if (href.includes('google.com/maps') || href.includes('directions')) {
            action = 'directions';
        } else if (href.startsWith('tel:')) {
            action = 'phone';
        } else if (href.startsWith('http')) {
            action = 'website';
        }

        trackShopClick(shopName, isIndependent, action);
    }

    /**
     * Open a modal dialog
     */
    function openModal(modal) {
        if (!modal) return;

        // If opening report modal, populate shops dropdown
        if (modal === elements.reportModal) {
            populateShopDropdown();
            trackFormOpen('report');
        } else if (modal === elements.suggestModal) {
            trackFormOpen('suggest');
        }

        modal.hidden = false;
        document.body.style.overflow = 'hidden';

        // Focus first input
        const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
        if (firstInput) {
            firstInput.focus();
        }
    }

    /**
     * Close a modal dialog
     */
    function closeModal(modal) {
        if (!modal) return;

        modal.hidden = true;
        document.body.style.overflow = '';

        // Reset form and success state
        const form = modal.querySelector('form');
        const success = modal.querySelector('.form-success');
        if (form) {
            form.reset();
            form.hidden = false;
        }
        if (success) {
            success.hidden = true;
        }

        // Clear shop search
        if (modal === elements.reportModal) {
            elements.reportShopSearch.value = '';
        }
    }

    /**
     * Populate the shop dropdown for report form
     */
    function populateShopDropdown(filter = '') {
        if (!shopsData || !shopsData.shops) return;

        const select = elements.reportShopSelect;
        const shops = filter
            ? filterShopsBySearchTerm(shopsData.shops, filter)
            : shopsData.shops;

        // Clear existing options except the placeholder
        select.innerHTML = '<option value="">-- Select a shop --</option>';

        // Sort shops alphabetically and add to dropdown
        const sortedShops = [...shops].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
        );

        sortedShops.forEach(shop => {
            const option = document.createElement('option');
            option.value = formatShopForSelect(shop);
            option.textContent = formatShopForSelect(shop);
            select.appendChild(option);
        });
    }

    /**
     * Handle shop search input
     */
    function handleShopSearch(e) {
        const searchTerm = e.target.value.trim();
        populateShopDropdown(searchTerm);
    }

    /**
     * Handle suggest form submission
     */
    async function handleSuggestSubmit(e) {
        e.preventDefault();

        const form = elements.suggestForm;
        const submitBtn = form.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                form.hidden = true;
                elements.suggestSuccess.hidden = false;
                trackFormSubmission('suggest');
            } else {
                throw new Error('Form submission failed');
            }
        } catch (error) {
            console.error('Suggest form error:', error);
            trackError('form_submit_failed', 'suggest');
            alert('There was an error submitting the form. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    }

    /**
     * Handle report form submission
     */
    async function handleReportSubmit(e) {
        e.preventDefault();

        const form = elements.reportForm;
        const submitBtn = form.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                form.hidden = true;
                elements.reportSuccess.hidden = false;
                trackFormSubmission('report');
            } else {
                throw new Error('Form submission failed');
            }
        } catch (error) {
            console.error('Report form error:', error);
            trackError('form_submit_failed', 'report');
            alert('There was an error submitting the form. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Report';
        }
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
                findNearbyShops(coordinates.lat, coordinates.lng, 'address');
            }
        } catch (error) {
            showError('Could not find that location. Please try a different address.');
            trackError('geocoding_failed', 'address');
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
            trackGeolocation(false, 'not_supported');
            return;
        }

        showLoading();
        hideError();

        navigator.geolocation.getCurrentPosition(
            (position) => {
                hideLoading();
                trackGeolocation(true);
                findNearbyShops(position.coords.latitude, position.coords.longitude, 'geolocation');
            },
            (error) => {
                hideLoading();
                let message = 'Could not get your location.';
                let errorType = 'unknown';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location access denied. Please enable location permissions or enter an address.';
                        errorType = 'permission_denied';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location information unavailable. Please try entering an address.';
                        errorType = 'position_unavailable';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out. Please try again.';
                        errorType = 'timeout';
                        break;
                }
                trackGeolocation(false, errorType);
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
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {string} searchMethod - Search method ('address' or 'geolocation')
     */
    function findNearbyShops(lat, lng, searchMethod = 'address') {
        if (!shopsData || !shopsData.shops) {
            showError('Shop data not available. Please refresh the page.');
            trackError('data_unavailable', searchMethod);
            return;
        }

        // Store user coordinates for map centering
        lastUserLat = lat;
        lastUserLng = lng;

        const nearbyShops = filterAndSortShops(
            shopsData.shops,
            lat,
            lng,
            CONFIG.MAX_DISTANCE_MILES,
            CONFIG.MAX_RESULTS
        );

        currentShops = nearbyShops;
        displayResults(nearbyShops, searchMethod);
    }

    /**
     * Display search results
     * @param {Array} shops - Array of shop objects
     * @param {string} searchMethod - Search method ('address' or 'geolocation')
     */
    function displayResults(shops, searchMethod = 'address') {
        elements.noResults.hidden = true;
        elements.resultsSection.hidden = true;
        elements.resultsList.innerHTML = '';

        // Track the search event
        trackSearch(searchMethod, shops.length);

        if (shops.length === 0) {
            elements.noResults.hidden = false;
            return;
        }

        // Track view results with nearest distance
        const nearestDistance = shops.length > 0 ? shops[0].distance : null;
        trackViewResults(shops.length, nearestDistance);

        // Update summary
        elements.resultsSummary.textContent = generateResultsSummary(shops);

        // Create shop cards with data attributes for tracking
        shops.forEach(shop => {
            const li = document.createElement('li');
            li.className = 'shop-card';
            li.dataset.shopName = shop.name || '';
            li.dataset.isIndependent = shop.isIndependent ? 'true' : 'false';
            li.innerHTML = createShopCardHTML(shop);
            elements.resultsList.appendChild(li);
        });

        // Update map markers
        updateMapMarkers(shops, lastUserLat, lastUserLng);

        elements.resultsSection.hidden = false;
        elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    /**
     * Initialize the Leaflet map
     */
    function initMap() {
        if (map) return; // Already initialized

        map = L.map(elements.resultsMap, {
            zoomControl: true,
            scrollWheelZoom: true
        });

        // Use OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        // Create a layer group for markers
        markersLayer = L.layerGroup().addTo(map);
    }

    /**
     * Update map markers with shop locations
     */
    function updateMapMarkers(shops, userLat, userLng) {
        // Initialize map if needed
        if (!map) {
            initMap();
        }

        // Clear existing markers
        markersLayer.clearLayers();

        // Add user location marker
        if (userLat && userLng) {
            const userIcon = L.divIcon({
                className: 'user-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            L.marker([userLat, userLng], { icon: userIcon })
                .addTo(markersLayer)
                .bindPopup('<div class="map-popup"><strong>Your Location</strong></div>');
        }

        // Add shop markers
        shops.forEach(shop => {
            if (typeof shop.lat !== 'number' || typeof shop.lng !== 'number') return;

            const markerClass = shop.isIndependent
                ? 'shop-marker shop-marker-independent'
                : 'shop-marker';

            const shopIcon = L.divIcon({
                className: markerClass,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            L.marker([shop.lat, shop.lng], { icon: shopIcon })
                .addTo(markersLayer)
                .bindPopup(createMapPopupHTML(shop));
        });

        // Fit bounds to show all markers
        const bounds = getMapBounds(shops);
        if (bounds && userLat && userLng) {
            // Include user location in bounds
            const allBounds = L.latLngBounds([
                [Math.min(bounds.south, userLat), Math.min(bounds.west, userLng)],
                [Math.max(bounds.north, userLat), Math.max(bounds.east, userLng)]
            ]);
            map.fitBounds(allBounds, { padding: [50, 50], maxZoom: 13 });
        } else if (bounds) {
            map.fitBounds([
                [bounds.south, bounds.west],
                [bounds.north, bounds.east]
            ], { padding: [50, 50], maxZoom: 13 });
        } else if (userLat && userLng) {
            map.setView([userLat, userLng], 12);
        }
    }

    /**
     * Switch between list and map views
     */
    function switchView(view) {
        if (view === currentView) return;

        currentView = view;
        trackViewChange(view);

        if (view === 'list') {
            elements.listViewBtn.classList.add('active');
            elements.listViewBtn.setAttribute('aria-selected', 'true');
            elements.mapViewBtn.classList.remove('active');
            elements.mapViewBtn.setAttribute('aria-selected', 'false');
            elements.resultsList.hidden = false;
            elements.resultsMap.hidden = true;
        } else {
            elements.mapViewBtn.classList.add('active');
            elements.mapViewBtn.setAttribute('aria-selected', 'true');
            elements.listViewBtn.classList.remove('active');
            elements.listViewBtn.setAttribute('aria-selected', 'false');
            elements.resultsList.hidden = true;
            elements.resultsMap.hidden = false;

            // Fix map display issues when switching to visible
            if (map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
