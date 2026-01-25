import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    CONFIG,
    calculateDistance,
    escapeHtml,
    createShopCardHTML,
    filterAndSortShops,
    generateResultsSummary,
    isValidCoordinates
} from '../app.utils.js';

describe('CONFIG', () => {
    it('should have expected default values', () => {
        assert.strictEqual(CONFIG.MAX_RESULTS, 20);
        assert.strictEqual(CONFIG.MAX_DISTANCE_MILES, 100);
        assert.strictEqual(CONFIG.EARTH_RADIUS_MILES, 3959);
        assert.strictEqual(CONFIG.DATA_FILE, 'shops.json');
    });
});

describe('calculateDistance', () => {
    it('should return 0 for same coordinates', () => {
        const distance = calculateDistance(34.0522, -118.2437, 34.0522, -118.2437);
        assert.strictEqual(distance, 0);
    });

    it('should calculate distance between Los Angeles and San Francisco (~382 miles)', () => {
        // LA: 34.0522, -118.2437
        // SF: 37.7749, -122.4194
        const distance = calculateDistance(34.0522, -118.2437, 37.7749, -122.4194);
        // Should be approximately 382 miles
        assert.ok(distance > 340 && distance < 400, `Expected ~382 miles, got ${distance}`);
    });

    it('should calculate distance between New York and Los Angeles (~2,451 miles)', () => {
        // NYC: 40.7128, -74.0060
        // LA: 34.0522, -118.2437
        const distance = calculateDistance(40.7128, -74.0060, 34.0522, -118.2437);
        // Should be approximately 2,451 miles
        assert.ok(distance > 2400 && distance < 2500, `Expected ~2,451 miles, got ${distance}`);
    });

    it('should handle short distances (< 1 mile)', () => {
        // Two points very close together in LA
        const distance = calculateDistance(34.0522, -118.2437, 34.0530, -118.2440);
        assert.ok(distance < 1, `Expected < 1 mile, got ${distance}`);
        assert.ok(distance > 0, 'Distance should be positive');
    });

    it('should handle crossing the prime meridian', () => {
        // London: 51.5074, -0.1278
        // Paris: 48.8566, 2.3522
        const distance = calculateDistance(51.5074, -0.1278, 48.8566, 2.3522);
        // Should be approximately 213 miles
        assert.ok(distance > 200 && distance < 230, `Expected ~213 miles, got ${distance}`);
    });

    it('should be symmetric (A to B equals B to A)', () => {
        const distanceAB = calculateDistance(34.0522, -118.2437, 37.7749, -122.4194);
        const distanceBA = calculateDistance(37.7749, -122.4194, 34.0522, -118.2437);
        assert.strictEqual(distanceAB, distanceBA);
    });

    it('should handle equator to pole distance', () => {
        // Equator to North Pole should be ~6,215 miles (quarter of circumference)
        const distance = calculateDistance(0, 0, 90, 0);
        assert.ok(distance > 6000 && distance < 6300, `Expected ~6,215 miles, got ${distance}`);
    });
});

describe('escapeHtml', () => {
    it('should escape ampersand', () => {
        assert.strictEqual(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
    });

    it('should escape less than', () => {
        assert.strictEqual(escapeHtml('a < b'), 'a &lt; b');
    });

    it('should escape greater than', () => {
        assert.strictEqual(escapeHtml('a > b'), 'a &gt; b');
    });

    it('should escape double quotes', () => {
        assert.strictEqual(escapeHtml('Say "hello"'), 'Say &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
        assert.strictEqual(escapeHtml("It's fine"), 'It&#39;s fine');
    });

    it('should escape multiple special characters', () => {
        assert.strictEqual(
            escapeHtml('<script>alert("XSS")</script>'),
            '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
        );
    });

    it('should return empty string for null', () => {
        assert.strictEqual(escapeHtml(null), '');
    });

    it('should return empty string for undefined', () => {
        assert.strictEqual(escapeHtml(undefined), '');
    });

    it('should handle empty string', () => {
        assert.strictEqual(escapeHtml(''), '');
    });

    it('should convert numbers to string', () => {
        assert.strictEqual(escapeHtml(123), '123');
    });

    it('should not modify safe strings', () => {
        assert.strictEqual(escapeHtml('Hello World'), 'Hello World');
    });
});

describe('createShopCardHTML', () => {
    it('should create basic shop card with required fields', () => {
        const shop = {
            name: 'Local Skate Shop',
            address: '123 Main St, City, CA 90210',
            distance: 5.5,
            isIndependent: true
        };
        const html = createShopCardHTML(shop);

        assert.ok(html.includes('Local Skate Shop'), 'Should include shop name');
        assert.ok(html.includes('123 Main St, City, CA 90210'), 'Should include address');
        assert.ok(html.includes('5.5 mi'), 'Should include distance');
        assert.ok(html.includes('badge-independent'), 'Should include independent badge');
    });

    it('should include website link when provided', () => {
        const shop = {
            name: 'Shop',
            address: '123 Main',
            distance: 1.0,
            isIndependent: true,
            website: 'https://example.com'
        };
        const html = createShopCardHTML(shop);

        assert.ok(html.includes('href="https://example.com"'), 'Should include website link');
        assert.ok(html.includes('Visit Website'), 'Should include link text');
        assert.ok(html.includes('target="_blank"'), 'Should open in new tab');
        assert.ok(html.includes('rel="noopener noreferrer"'), 'Should have security attributes');
    });

    it('should include phone when provided', () => {
        const shop = {
            name: 'Shop',
            address: '123 Main',
            distance: 1.0,
            isIndependent: true,
            phone: '(555) 123-4567'
        };
        const html = createShopCardHTML(shop);

        assert.ok(html.includes('(555) 123-4567'), 'Should include phone number');
        assert.ok(html.includes('shop-phone'), 'Should have phone class');
    });

    it('should not include independent badge for chain stores', () => {
        const shop = {
            name: 'Zumiez',
            address: '123 Mall Ave',
            distance: 2.0,
            isIndependent: false
        };
        const html = createShopCardHTML(shop);

        assert.ok(!html.includes('badge-independent'), 'Should not include independent badge');
    });

    it('should escape HTML in shop name to prevent XSS', () => {
        const shop = {
            name: '<script>alert("xss")</script>',
            address: '123 Main',
            distance: 1.0,
            isIndependent: true
        };
        const html = createShopCardHTML(shop);

        assert.ok(!html.includes('<script>'), 'Should escape script tags');
        assert.ok(html.includes('&lt;script&gt;'), 'Should contain escaped version');
    });

    it('should escape HTML in website URL', () => {
        const shop = {
            name: 'Shop',
            address: '123 Main',
            distance: 1.0,
            isIndependent: true,
            website: 'https://example.com?a=1&b=2'
        };
        const html = createShopCardHTML(shop);

        assert.ok(html.includes('&amp;'), 'Should escape ampersand in URL');
    });

    it('should handle missing distance gracefully', () => {
        const shop = {
            name: 'Shop',
            address: '123 Main',
            isIndependent: true
        };
        const html = createShopCardHTML(shop);

        assert.ok(html.includes('? mi'), 'Should show ? for unknown distance');
    });
});

describe('filterAndSortShops', () => {
    const mockShops = [
        { id: 1, name: 'Shop A', lat: 34.10, lng: -118.20 },  // ~5 miles from origin
        { id: 2, name: 'Shop B', lat: 34.50, lng: -118.50 },  // ~35 miles from origin
        { id: 3, name: 'Shop C', lat: 35.00, lng: -119.00 },  // ~80 miles from origin
        { id: 4, name: 'Shop D', lat: 36.00, lng: -120.00 },  // ~150 miles from origin
        { id: 5, name: 'Shop E', lat: 34.05, lng: -118.24 },  // ~0.3 miles from origin
    ];
    const userLat = 34.0522;
    const userLng = -118.2437;

    it('should return shops sorted by distance (nearest first)', () => {
        const result = filterAndSortShops(mockShops, userLat, userLng);

        assert.ok(result.length > 0, 'Should return results');
        assert.strictEqual(result[0].name, 'Shop E', 'Nearest shop should be first');

        // Verify ascending order
        for (let i = 1; i < result.length; i++) {
            assert.ok(
                result[i].distance >= result[i - 1].distance,
                `Shop at index ${i} should be further than index ${i - 1}`
            );
        }
    });

    it('should filter shops beyond max distance', () => {
        const result = filterAndSortShops(mockShops, userLat, userLng, 100);

        // Shop D is ~150 miles away, should be excluded
        const hasShopD = result.some(shop => shop.name === 'Shop D');
        assert.ok(!hasShopD, 'Should not include shops beyond max distance');
    });

    it('should limit results to maxResults', () => {
        const result = filterAndSortShops(mockShops, userLat, userLng, 200, 3);

        assert.strictEqual(result.length, 3, 'Should limit to 3 results');
    });

    it('should add distance property to each shop', () => {
        const result = filterAndSortShops(mockShops, userLat, userLng);

        result.forEach(shop => {
            assert.ok(typeof shop.distance === 'number', 'Each shop should have distance');
            assert.ok(shop.distance >= 0, 'Distance should be non-negative');
        });
    });

    it('should return empty array for null input', () => {
        const result = filterAndSortShops(null, userLat, userLng);
        assert.deepStrictEqual(result, []);
    });

    it('should return empty array for undefined input', () => {
        const result = filterAndSortShops(undefined, userLat, userLng);
        assert.deepStrictEqual(result, []);
    });

    it('should return empty array for non-array input', () => {
        const result = filterAndSortShops('not an array', userLat, userLng);
        assert.deepStrictEqual(result, []);
    });

    it('should filter out shops with invalid coordinates', () => {
        const shopsWithInvalid = [
            { id: 1, name: 'Valid', lat: 34.05, lng: -118.24 },
            { id: 2, name: 'Missing lat', lng: -118.24 },
            { id: 3, name: 'Missing lng', lat: 34.05 },
            { id: 4, name: 'NaN lat', lat: NaN, lng: -118.24 },
            { id: 5, name: 'String coords', lat: 'invalid', lng: -118.24 },
        ];

        const result = filterAndSortShops(shopsWithInvalid, userLat, userLng);

        assert.strictEqual(result.length, 1, 'Should only include shop with valid coords');
        assert.strictEqual(result[0].name, 'Valid');
    });

    it('should use default max distance and max results', () => {
        const result = filterAndSortShops(mockShops, userLat, userLng);

        // Default max distance is 100, Shop D at ~150 should be excluded
        const hasShopD = result.some(shop => shop.name === 'Shop D');
        assert.ok(!hasShopD, 'Should use default max distance of 100');
    });

    it('should preserve original shop properties', () => {
        const shopsWithExtras = [
            { id: 1, name: 'Shop', lat: 34.05, lng: -118.24, website: 'https://example.com', phone: '555-1234' }
        ];

        const result = filterAndSortShops(shopsWithExtras, userLat, userLng);

        assert.strictEqual(result[0].id, 1);
        assert.strictEqual(result[0].name, 'Shop');
        assert.strictEqual(result[0].website, 'https://example.com');
        assert.strictEqual(result[0].phone, '555-1234');
    });
});

describe('generateResultsSummary', () => {
    it('should generate summary for multiple shops', () => {
        const shops = [
            { name: 'Shop A', distance: 2.3 },
            { name: 'Shop B', distance: 5.7 },
            { name: 'Shop C', distance: 10.2 },
        ];

        const summary = generateResultsSummary(shops);

        assert.strictEqual(summary, 'Showing 3 shops within 10.2 miles');
    });

    it('should handle singular shop', () => {
        const shops = [{ name: 'Shop A', distance: 2.5 }];

        const summary = generateResultsSummary(shops);

        assert.strictEqual(summary, 'Showing 1 shop within 2.5 miles');
    });

    it('should return empty string for empty array', () => {
        const summary = generateResultsSummary([]);
        assert.strictEqual(summary, '');
    });

    it('should return empty string for null', () => {
        const summary = generateResultsSummary(null);
        assert.strictEqual(summary, '');
    });

    it('should return empty string for undefined', () => {
        const summary = generateResultsSummary(undefined);
        assert.strictEqual(summary, '');
    });

    it('should round distance to 1 decimal place', () => {
        const shops = [{ name: 'Shop', distance: 5.789 }];

        const summary = generateResultsSummary(shops);

        assert.ok(summary.includes('5.8 miles'), 'Should round to 1 decimal');
    });
});

describe('isValidCoordinates', () => {
    it('should return true for valid coordinates', () => {
        assert.strictEqual(isValidCoordinates(34.0522, -118.2437), true);
    });

    it('should return true for boundary values', () => {
        assert.strictEqual(isValidCoordinates(90, 180), true);
        assert.strictEqual(isValidCoordinates(-90, -180), true);
        assert.strictEqual(isValidCoordinates(0, 0), true);
    });

    it('should return false for latitude out of range', () => {
        assert.strictEqual(isValidCoordinates(91, 0), false);
        assert.strictEqual(isValidCoordinates(-91, 0), false);
    });

    it('should return false for longitude out of range', () => {
        assert.strictEqual(isValidCoordinates(0, 181), false);
        assert.strictEqual(isValidCoordinates(0, -181), false);
    });

    it('should return false for NaN values', () => {
        assert.strictEqual(isValidCoordinates(NaN, 0), false);
        assert.strictEqual(isValidCoordinates(0, NaN), false);
    });

    it('should return false for string values', () => {
        assert.strictEqual(isValidCoordinates('34.0522', -118.2437), false);
        assert.strictEqual(isValidCoordinates(34.0522, '-118.2437'), false);
    });

    it('should return false for null values', () => {
        assert.strictEqual(isValidCoordinates(null, 0), false);
        assert.strictEqual(isValidCoordinates(0, null), false);
    });

    it('should return false for undefined values', () => {
        assert.strictEqual(isValidCoordinates(undefined, 0), false);
        assert.strictEqual(isValidCoordinates(0, undefined), false);
    });
});
