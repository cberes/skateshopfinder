import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeShop, normalizeShops, prepareForOutput } from '../processors/normalizer.js';

describe('normalizeShop', () => {
  describe('name normalization', () => {
    it('should trim whitespace from name', () => {
      const shop = { id: '1', name: '  Shop Name  ', lat: 34.0, lng: -118.0 };
      const result = normalizeShop(shop);
      assert.strictEqual(result.name, 'Shop Name');
    });

    it('should normalize multiple spaces', () => {
      const shop = { id: '1', name: 'Shop   Name', lat: 34.0, lng: -118.0 };
      const result = normalizeShop(shop);
      assert.strictEqual(result.name, 'Shop Name');
    });

    it('should fix HTML entities', () => {
      const shop = { id: '1', name: 'Tom &amp; Jerry&#39;s', lat: 34.0, lng: -118.0 };
      const result = normalizeShop(shop);
      assert.strictEqual(result.name, "Tom & Jerry's");
    });

    it('should default to Unknown Skateshop for missing name', () => {
      const shop = { id: '1', lat: 34.0, lng: -118.0 };
      const result = normalizeShop(shop);
      assert.strictEqual(result.name, 'Unknown Skateshop');
    });
  });

  describe('phone normalization', () => {
    it('should format 10-digit phone numbers', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, phone: '5551234567' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.phone, '(555) 123-4567');
    });

    it('should handle phone with dashes', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, phone: '555-123-4567' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.phone, '(555) 123-4567');
    });

    it('should handle phone with dots', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, phone: '555.123.4567' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.phone, '(555) 123-4567');
    });

    it('should handle 11-digit phone starting with 1', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, phone: '15551234567' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.phone, '(555) 123-4567');
    });

    it('should handle phone with parentheses', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, phone: '(555) 123-4567' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.phone, '(555) 123-4567');
    });

    it('should return null for missing phone', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0 };
      const result = normalizeShop(shop);
      assert.strictEqual(result.phone, null);
    });
  });

  describe('website normalization', () => {
    it('should add https:// to bare domain', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, website: 'example.com' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.website, 'https://example.com');
    });

    it('should add https:// to www domain', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, website: 'www.example.com' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.website, 'https://www.example.com');
    });

    it('should preserve existing https://', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, website: 'https://example.com' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.website, 'https://example.com');
    });

    it('should preserve existing http://', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, website: 'http://example.com' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.website, 'http://example.com');
    });

    it('should return null for invalid URL', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, website: 'not a url' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.website, null);
    });

    it('should return null for empty URL', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, website: '' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.website, null);
    });

    it('should return null for missing website', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0 };
      const result = normalizeShop(shop);
      assert.strictEqual(result.website, null);
    });

    it('should remove trailing slash from root path', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, website: 'https://example.com/' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.website, 'https://example.com');
    });
  });

  describe('coordinate normalization', () => {
    it('should round coordinates to 6 decimal places', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.12345678, lng: -118.87654321 };
      const result = normalizeShop(shop);
      assert.strictEqual(result.lat, 34.123457);
      assert.strictEqual(result.lng, -118.876543);
    });

    it('should return null for invalid coordinates', () => {
      const shop = { id: '1', name: 'Shop', lat: 'invalid', lng: -118.0 };
      const result = normalizeShop(shop);
      assert.strictEqual(result.lat, null);
    });

    it('should return null for NaN coordinates', () => {
      const shop = { id: '1', name: 'Shop', lat: NaN, lng: -118.0 };
      const result = normalizeShop(shop);
      assert.strictEqual(result.lat, null);
    });
  });

  describe('address normalization', () => {
    it('should normalize whitespace in address', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, address: '123  Main   St' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.address, '123 Main St.');
    });

    it('should normalize comma spacing', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0, address: 'LA,CA' };
      const result = normalizeShop(shop);
      assert.strictEqual(result.address, 'LA, CA');
    });

    it('should return null for missing address', () => {
      const shop = { id: '1', name: 'Shop', lat: 34.0, lng: -118.0 };
      const result = normalizeShop(shop);
      assert.strictEqual(result.address, null);
    });
  });
});

describe('normalizeShops', () => {
  it('should normalize all shops in array', () => {
    const shops = [
      { id: '1', name: '  Shop A  ', lat: 34.0, lng: -118.0 },
      { id: '2', name: '  Shop B  ', lat: 35.0, lng: -119.0 },
    ];
    const result = normalizeShops(shops);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'Shop A');
    assert.strictEqual(result[1].name, 'Shop B');
  });
});

describe('prepareForOutput', () => {
  it('should remove internal metadata', () => {
    const shops = [
      {
        id: '1',
        name: 'Shop',
        address: '123 Main',
        lat: 34.0,
        lng: -118.0,
        website: 'https://example.com',
        phone: '(555) 123-4567',
        isIndependent: true,
        _source: 'osm',
        _osmId: 12345,
      },
    ];
    const result = prepareForOutput(shops);
    assert.strictEqual(result[0]._source, undefined);
    assert.strictEqual(result[0]._osmId, undefined);
    assert.strictEqual(result[0].id, '1');
    assert.strictEqual(result[0].name, 'Shop');
  });

  it('should only include optional fields if they have values', () => {
    const shops = [
      { id: '1', name: 'Shop', address: null, lat: 34.0, lng: -118.0, isIndependent: true },
    ];
    const result = prepareForOutput(shops);
    assert.strictEqual(result[0].website, undefined);
    assert.strictEqual(result[0].phone, undefined);
  });
});
