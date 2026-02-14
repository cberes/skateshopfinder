import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildShareParams,
  CONFIG,
  calculateDistance,
  createMapPopupHTML,
  createShopCardHTML,
  escapeHtml,
  extractCityState,
  filterAndSortShops,
  filterShopsBySearchTerm,
  formatShopForSelect,
  generateResultsSummary,
  getMapBounds,
  isValidCoordinates,
  parseShareParams,
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
    const distance = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
    // Should be approximately 2,451 miles
    assert.ok(distance > 2400 && distance < 2500, `Expected ~2,451 miles, got ${distance}`);
  });

  it('should handle short distances (< 1 mile)', () => {
    // Two points very close together in LA
    const distance = calculateDistance(34.0522, -118.2437, 34.053, -118.244);
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
      isIndependent: true,
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
      website: 'https://example.com',
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
      phone: '(555) 123-4567',
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
      isIndependent: false,
    };
    const html = createShopCardHTML(shop);

    assert.ok(!html.includes('badge-independent'), 'Should not include independent badge');
  });

  it('should escape HTML in shop name to prevent XSS', () => {
    const shop = {
      name: '<script>alert("xss")</script>',
      address: '123 Main',
      distance: 1.0,
      isIndependent: true,
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
      website: 'https://example.com?a=1&b=2',
    };
    const html = createShopCardHTML(shop);

    assert.ok(html.includes('&amp;'), 'Should escape ampersand in URL');
  });

  it('should handle missing distance gracefully', () => {
    const shop = {
      name: 'Shop',
      address: '123 Main',
      isIndependent: true,
    };
    const html = createShopCardHTML(shop);

    assert.ok(html.includes('? mi'), 'Should show ? for unknown distance');
  });

  it('should include photo when provided', () => {
    const shop = {
      name: 'Photo Shop',
      address: '123 Main',
      distance: 1.0,
      isIndependent: true,
      photo: '42.jpg',
    };
    const html = createShopCardHTML(shop);

    assert.ok(html.includes('shop-photo'), 'Should include photo container');
    assert.ok(html.includes('images/shops/42.jpg'), 'Should include photo src');
    assert.ok(html.includes('loading="lazy"'), 'Should lazy load photo');
    assert.ok(html.includes('alt="Photo Shop"'), 'Should include alt text');
    assert.ok(html.includes('onerror'), 'Should include error handler');
  });

  it('should not include photo when not provided', () => {
    const shop = {
      name: 'No Photo Shop',
      address: '123 Main',
      distance: 1.0,
      isIndependent: true,
    };
    const html = createShopCardHTML(shop);

    assert.ok(!html.includes('shop-photo'), 'Should not include photo container');
    assert.ok(!html.includes('<img'), 'Should not include img tag');
  });

  it('should escape shop name in photo alt text', () => {
    const shop = {
      name: 'Tom & Jerry\'s "Shop"',
      address: '123 Main',
      distance: 1.0,
      isIndependent: true,
      photo: '1.jpg',
    };
    const html = createShopCardHTML(shop);

    assert.ok(!html.includes('alt="Tom & Jerry'), 'Should escape ampersand in alt');
    assert.ok(html.includes('&amp;'), 'Should contain escaped ampersand');
  });
});

describe('filterAndSortShops', () => {
  const mockShops = [
    { id: 1, name: 'Shop A', lat: 34.1, lng: -118.2 }, // ~5 miles from origin
    { id: 2, name: 'Shop B', lat: 34.5, lng: -118.5 }, // ~35 miles from origin
    { id: 3, name: 'Shop C', lat: 35.0, lng: -119.0 }, // ~80 miles from origin
    { id: 4, name: 'Shop D', lat: 36.0, lng: -120.0 }, // ~150 miles from origin
    { id: 5, name: 'Shop E', lat: 34.05, lng: -118.24 }, // ~0.3 miles from origin
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
    const hasShopD = result.some((shop) => shop.name === 'Shop D');
    assert.ok(!hasShopD, 'Should not include shops beyond max distance');
  });

  it('should limit results to maxResults', () => {
    const result = filterAndSortShops(mockShops, userLat, userLng, 200, 3);

    assert.strictEqual(result.length, 3, 'Should limit to 3 results');
  });

  it('should add distance property to each shop', () => {
    const result = filterAndSortShops(mockShops, userLat, userLng);

    result.forEach((shop) => {
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
    const hasShopD = result.some((shop) => shop.name === 'Shop D');
    assert.ok(!hasShopD, 'Should use default max distance of 100');
  });

  it('should preserve original shop properties', () => {
    const shopsWithExtras = [
      {
        id: 1,
        name: 'Shop',
        lat: 34.05,
        lng: -118.24,
        website: 'https://example.com',
        phone: '555-1234',
      },
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

describe('filterShopsBySearchTerm', () => {
  const mockShops = [
    { id: 1, name: 'Local Skate Shop', address: '123 Main St, Los Angeles, CA 90001' },
    { id: 2, name: 'Boardroom', address: '456 Oak Ave, San Francisco, CA 94102' },
    { id: 3, name: 'Zumiez Mall Store', address: '789 Mall Blvd, Seattle, WA 98101' },
    { id: 4, name: 'Skate Warehouse', address: '321 Elm St, Portland, OR 97201' },
  ];

  it('should return all shops when search term is empty', () => {
    const result = filterShopsBySearchTerm(mockShops, '');
    assert.strictEqual(result.length, 4);
  });

  it('should filter by shop name (case insensitive)', () => {
    const result = filterShopsBySearchTerm(mockShops, 'zumiez');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Zumiez Mall Store');
  });

  it('should filter by city name', () => {
    const result = filterShopsBySearchTerm(mockShops, 'seattle');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Zumiez Mall Store');
  });

  it('should filter by state', () => {
    const result = filterShopsBySearchTerm(mockShops, 'CA');
    assert.strictEqual(result.length, 2);
  });

  it('should filter by partial match in name', () => {
    const result = filterShopsBySearchTerm(mockShops, 'skate');
    assert.strictEqual(result.length, 2);
    assert.ok(result.some((s) => s.name === 'Local Skate Shop'));
    assert.ok(result.some((s) => s.name === 'Skate Warehouse'));
  });

  it('should return empty array when no matches', () => {
    const result = filterShopsBySearchTerm(mockShops, 'nonexistent');
    assert.strictEqual(result.length, 0);
  });

  it('should handle null shops array', () => {
    const result = filterShopsBySearchTerm(null, 'test');
    assert.deepStrictEqual(result, []);
  });

  it('should handle undefined shops array', () => {
    const result = filterShopsBySearchTerm(undefined, 'test');
    assert.deepStrictEqual(result, []);
  });

  it('should return original array when search term is null', () => {
    const result = filterShopsBySearchTerm(mockShops, null);
    assert.strictEqual(result.length, 4);
  });

  it('should handle shops with missing name or address', () => {
    const shopsWithMissing = [
      { id: 1, name: 'Shop One' },
      { id: 2, address: '123 Test St' },
      { id: 3 },
    ];
    const result = filterShopsBySearchTerm(shopsWithMissing, 'test');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 2);
  });

  it('should trim whitespace from search term', () => {
    const result = filterShopsBySearchTerm(mockShops, '  zumiez  ');
    assert.strictEqual(result.length, 1);
  });
});

describe('extractCityState', () => {
  it('should extract city and state from full address', () => {
    const result = extractCityState('123 Main St, Los Angeles, CA 90001');
    assert.strictEqual(result, 'Los Angeles, CA');
  });

  it('should handle address without ZIP code', () => {
    const result = extractCityState('123 Main St, Portland, OR');
    assert.strictEqual(result, 'Portland, OR');
  });

  it('should return empty string for empty address', () => {
    const result = extractCityState('');
    assert.strictEqual(result, '');
  });

  it('should return empty string for null', () => {
    const result = extractCityState(null);
    assert.strictEqual(result, '');
  });

  it('should return empty string for undefined', () => {
    const result = extractCityState(undefined);
    assert.strictEqual(result, '');
  });

  it('should handle address with only city', () => {
    const result = extractCityState('Los Angeles');
    assert.strictEqual(result, '');
  });

  it('should handle multi-part city names', () => {
    const result = extractCityState('456 Oak Ave, San Francisco, CA 94102');
    assert.strictEqual(result, 'San Francisco, CA');
  });

  it('should handle address with suite number', () => {
    const result = extractCityState('123 Main St Suite 100, Denver, CO 80202');
    assert.strictEqual(result, 'Denver, CO');
  });
});

describe('formatShopForSelect', () => {
  it('should format shop with name and full address', () => {
    const shop = {
      name: 'Local Skate Shop',
      address: '123 Main St, Los Angeles, CA 90001',
    };
    const result = formatShopForSelect(shop);
    assert.strictEqual(result, 'Local Skate Shop - Los Angeles, CA');
  });

  it('should return just name when address is missing', () => {
    const shop = { name: 'Local Skate Shop' };
    const result = formatShopForSelect(shop);
    assert.strictEqual(result, 'Local Skate Shop');
  });

  it('should return just name when address has no city/state', () => {
    const shop = { name: 'Local Skate Shop', address: '123 Main St' };
    const result = formatShopForSelect(shop);
    assert.strictEqual(result, 'Local Skate Shop');
  });

  it('should return "Unknown Shop" when name is missing', () => {
    const shop = { address: '123 Main St, LA, CA 90001' };
    const result = formatShopForSelect(shop);
    assert.strictEqual(result, 'Unknown Shop - LA, CA');
  });

  it('should return empty string for null shop', () => {
    const result = formatShopForSelect(null);
    assert.strictEqual(result, '');
  });

  it('should return empty string for undefined shop', () => {
    const result = formatShopForSelect(undefined);
    assert.strictEqual(result, '');
  });

  it('should handle empty shop object', () => {
    const result = formatShopForSelect({});
    assert.strictEqual(result, 'Unknown Shop');
  });
});

describe('createMapPopupHTML', () => {
  it('should create popup with basic shop info', () => {
    const shop = {
      name: 'Local Skate Shop',
      address: '123 Main St, City, CA 90210',
      distance: 5.5,
      lat: 34.0522,
      lng: -118.2437,
      isIndependent: true,
    };
    const html = createMapPopupHTML(shop);

    assert.ok(html.includes('Local Skate Shop'), 'Should include shop name');
    assert.ok(html.includes('123 Main St, City, CA 90210'), 'Should include address');
    assert.ok(html.includes('5.5 mi'), 'Should include distance');
    assert.ok(html.includes('popup-badge-independent'), 'Should include independent badge');
  });

  it('should include website link when provided', () => {
    const shop = {
      name: 'Shop',
      address: '123 Main',
      distance: 1.0,
      lat: 34.0522,
      lng: -118.2437,
      isIndependent: false,
      website: 'https://example.com',
    };
    const html = createMapPopupHTML(shop);

    assert.ok(html.includes('href="https://example.com"'), 'Should include website link');
    assert.ok(html.includes('target="_blank"'), 'Should open in new tab');
  });

  it('should include phone link when provided', () => {
    const shop = {
      name: 'Shop',
      address: '123 Main',
      distance: 1.0,
      lat: 34.0522,
      lng: -118.2437,
      isIndependent: false,
      phone: '(555) 123-4567',
    };
    const html = createMapPopupHTML(shop);

    assert.ok(html.includes('(555) 123-4567'), 'Should include phone display');
    assert.ok(html.includes('href="tel:5551234567"'), 'Should include tel link with digits only');
  });

  it('should not include independent badge for chain stores', () => {
    const shop = {
      name: 'Zumiez',
      address: '123 Mall Ave',
      distance: 2.0,
      lat: 34.0522,
      lng: -118.2437,
      isIndependent: false,
    };
    const html = createMapPopupHTML(shop);

    assert.ok(!html.includes('popup-badge-independent'), 'Should not include independent badge');
  });

  it('should escape HTML in shop name to prevent XSS', () => {
    const shop = {
      name: '<script>alert("xss")</script>',
      address: '123 Main',
      distance: 1.0,
      lat: 34.0522,
      lng: -118.2437,
      isIndependent: false,
    };
    const html = createMapPopupHTML(shop);

    assert.ok(!html.includes('<script>'), 'Should escape script tags');
    assert.ok(html.includes('&lt;script&gt;'), 'Should contain escaped version');
  });

  it('should include directions link to Google Maps', () => {
    const shop = {
      name: 'Shop',
      address: '123 Main St, City, CA',
      distance: 1.0,
      lat: 34.0522,
      lng: -118.2437,
      isIndependent: false,
    };
    const html = createMapPopupHTML(shop);

    assert.ok(html.includes('google.com/maps/dir'), 'Should include Google Maps directions');
    assert.ok(html.includes('Get Directions'), 'Should include directions text');
    assert.ok(html.includes('popup-directions'), 'Should have directions class');
  });

  it('should handle missing distance gracefully', () => {
    const shop = {
      name: 'Shop',
      address: '123 Main',
      lat: 34.0522,
      lng: -118.2437,
      isIndependent: false,
    };
    const html = createMapPopupHTML(shop);

    assert.ok(html.includes('? mi'), 'Should show ? for unknown distance');
  });

  it('should encode address in directions URL', () => {
    const shop = {
      name: 'Shop',
      address: '123 Main St, Los Angeles, CA',
      distance: 1.0,
      lat: 34.0522,
      lng: -118.2437,
      isIndependent: false,
    };
    const html = createMapPopupHTML(shop);

    assert.ok(
      html.includes(encodeURIComponent('123 Main St, Los Angeles, CA')),
      'Should encode address in URL'
    );
  });

  it('should include photo when provided', () => {
    const shop = {
      name: 'Photo Shop',
      address: '123 Main',
      distance: 1.0,
      lat: 34.0522,
      lng: -118.2437,
      isIndependent: true,
      photo: '42.jpg',
    };
    const html = createMapPopupHTML(shop);

    assert.ok(html.includes('popup-photo'), 'Should include popup photo container');
    assert.ok(html.includes('images/shops/42.jpg'), 'Should include photo src');
    assert.ok(html.includes('loading="lazy"'), 'Should lazy load photo');
    assert.ok(html.includes('onerror'), 'Should include error handler');
  });

  it('should not include photo when not provided', () => {
    const shop = {
      name: 'No Photo Shop',
      address: '123 Main',
      distance: 1.0,
      lat: 34.0522,
      lng: -118.2437,
      isIndependent: false,
    };
    const html = createMapPopupHTML(shop);

    assert.ok(!html.includes('popup-photo'), 'Should not include popup photo container');
  });
});

describe('getMapBounds', () => {
  it('should return null for empty array', () => {
    const result = getMapBounds([]);
    assert.strictEqual(result, null);
  });

  it('should return null for null input', () => {
    const result = getMapBounds(null);
    assert.strictEqual(result, null);
  });

  it('should return null for undefined input', () => {
    const result = getMapBounds(undefined);
    assert.strictEqual(result, null);
  });

  it('should return bounds for single shop', () => {
    const shops = [{ lat: 34.0522, lng: -118.2437 }];
    const result = getMapBounds(shops);

    assert.deepStrictEqual(result, {
      north: 34.0522,
      south: 34.0522,
      east: -118.2437,
      west: -118.2437,
    });
  });

  it('should return correct bounds for multiple shops', () => {
    const shops = [
      { lat: 34.0522, lng: -118.2437 }, // LA
      { lat: 37.7749, lng: -122.4194 }, // SF
      { lat: 32.7157, lng: -117.1611 }, // San Diego
    ];
    const result = getMapBounds(shops);

    assert.strictEqual(result.north, 37.7749, 'North should be SF latitude');
    assert.strictEqual(result.south, 32.7157, 'South should be SD latitude');
    assert.strictEqual(result.east, -117.1611, 'East should be SD longitude');
    assert.strictEqual(result.west, -122.4194, 'West should be SF longitude');
  });

  it('should filter out shops with invalid coordinates', () => {
    const shops = [
      { lat: 34.0522, lng: -118.2437 }, // Valid
      { lat: NaN, lng: -118.2437 }, // Invalid lat
      { lat: 37.7749, lng: null }, // Invalid lng
      { lat: undefined, lng: -122.4194 }, // Invalid lat
      { name: 'No coords' }, // Missing coords
    ];
    const result = getMapBounds(shops);

    assert.deepStrictEqual(result, {
      north: 34.0522,
      south: 34.0522,
      east: -118.2437,
      west: -118.2437,
    });
  });

  it('should return null when all shops have invalid coordinates', () => {
    const shops = [
      { lat: NaN, lng: -118.2437 },
      { lat: 'invalid', lng: -118.2437 },
      { name: 'No coords' },
    ];
    const result = getMapBounds(shops);

    assert.strictEqual(result, null);
  });
});

describe('buildShareParams', () => {
  it('should return ?q= for address search', () => {
    const result = buildShareParams('address', 'Denver, CO', 39.7392, -104.9903);
    assert.strictEqual(result, '?q=Denver%2C%20CO');
  });

  it('should encode special characters in address', () => {
    const result = buildShareParams('address', '123 Main St, City & State', 0, 0);
    assert.ok(result.startsWith('?q='), 'Should start with ?q=');
    assert.ok(result.includes('%26'), 'Should encode ampersand');
  });

  it('should return ?lat=&lng= for geolocation search', () => {
    const result = buildShareParams('geolocation', '', 39.7392, -104.9903);
    assert.strictEqual(result, '?lat=39.7392&lng=-104.9903');
  });

  it('should use lat/lng even when address is provided for non-address search', () => {
    const result = buildShareParams('geolocation', 'Denver, CO', 39.7392, -104.9903);
    assert.strictEqual(result, '?lat=39.7392&lng=-104.9903');
  });

  it('should return empty string when address search has no address', () => {
    const result = buildShareParams('address', '', null, null);
    assert.strictEqual(result, '');
  });

  it('should return empty string when geolocation has NaN coords', () => {
    const result = buildShareParams('geolocation', '', NaN, NaN);
    assert.strictEqual(result, '');
  });

  it('should return empty string when geolocation has non-number coords', () => {
    const result = buildShareParams('geolocation', '', 'bad', 'data');
    assert.strictEqual(result, '');
  });
});

describe('parseShareParams', () => {
  it('should parse address query param', () => {
    const result = parseShareParams('?q=Denver%2C+CO');
    assert.deepStrictEqual(result, { type: 'address', q: 'Denver, CO' });
  });

  it('should parse lat/lng query params', () => {
    const result = parseShareParams('?lat=39.7392&lng=-104.9903');
    assert.deepStrictEqual(result, { type: 'geo', lat: 39.7392, lng: -104.9903 });
  });

  it('should prefer q over lat/lng when both present', () => {
    const result = parseShareParams('?q=Denver&lat=39.7392&lng=-104.9903');
    assert.strictEqual(result.type, 'address');
    assert.strictEqual(result.q, 'Denver');
  });

  it('should return null for empty search string', () => {
    const result = parseShareParams('');
    assert.strictEqual(result, null);
  });

  it('should return null for search with no recognized params', () => {
    const result = parseShareParams('?foo=bar');
    assert.strictEqual(result, null);
  });

  it('should return null when lat is present but lng is missing', () => {
    const result = parseShareParams('?lat=39.7392');
    assert.strictEqual(result, null);
  });

  it('should return null when lng is present but lat is missing', () => {
    const result = parseShareParams('?lng=-104.9903');
    assert.strictEqual(result, null);
  });

  it('should return null when lat/lng are not valid numbers', () => {
    const result = parseShareParams('?lat=abc&lng=def');
    assert.strictEqual(result, null);
  });

  it('should handle negative coordinates', () => {
    const result = parseShareParams('?lat=-33.8688&lng=151.2093');
    assert.deepStrictEqual(result, { type: 'geo', lat: -33.8688, lng: 151.2093 });
  });
});
