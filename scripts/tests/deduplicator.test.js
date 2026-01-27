import assert from 'node:assert';
import { describe, it } from 'node:test';
import { deduplicateShops } from '../processors/deduplicator.js';

describe('deduplicateShops', () => {
  it('should return empty array for empty input', () => {
    const result = deduplicateShops([]);
    assert.deepStrictEqual(result, []);
  });

  it('should not modify unique shops', () => {
    const shops = [
      { id: '1', name: 'Shop A', lat: 34.0, lng: -118.0, address: '123 Main St, LA, CA' },
      { id: '2', name: 'Shop B', lat: 35.0, lng: -119.0, address: '456 Oak Ave, SF, CA' },
    ];
    const result = deduplicateShops(shops);
    assert.strictEqual(result.length, 2);
  });

  it('should merge shops with same coordinates', () => {
    const shops = [
      { id: '1', name: 'Shop A', lat: 34.0, lng: -118.0, source: 'osm' },
      { id: '2', name: 'Shop A Copy', lat: 34.0, lng: -118.0, source: 'manual' },
    ];
    const result = deduplicateShops(shops);
    assert.strictEqual(result.length, 1);
  });

  it('should merge shops within coordinate threshold', () => {
    const shops = [
      { id: '1', name: 'Shop A', lat: 34.0, lng: -118.0, source: 'osm' },
      { id: '2', name: 'Shop A', lat: 34.00005, lng: -118.00005, source: 'manual' },
    ];
    const result = deduplicateShops(shops);
    assert.strictEqual(result.length, 1);
  });

  it('should not merge shops with different coordinates', () => {
    const shops = [
      { id: '1', name: 'Shop A', lat: 34.0, lng: -118.0 },
      { id: '2', name: 'Shop B', lat: 35.0, lng: -119.0 },
    ];
    const result = deduplicateShops(shops);
    assert.strictEqual(result.length, 2);
  });

  it('should merge shops with same normalized name and city', () => {
    const shops = [
      {
        id: '1',
        name: 'Cool Skate Shop',
        lat: 34.0,
        lng: -118.0,
        address: '123 Main, Los Angeles, CA',
      },
      {
        id: '2',
        name: 'Cool Skate Shop',
        lat: 34.1,
        lng: -118.1,
        address: '456 Oak, Los Angeles, CA',
      },
    ];
    const result = deduplicateShops(shops);
    assert.strictEqual(result.length, 1);
  });

  it('should not merge shops with same name but different cities', () => {
    const shops = [
      {
        id: '1',
        name: 'Cool Skate Shop',
        lat: 34.0,
        lng: -118.0,
        address: '123 Main, Los Angeles, CA',
      },
      {
        id: '2',
        name: 'Cool Skate Shop',
        lat: 37.0,
        lng: -122.0,
        address: '456 Oak, San Francisco, CA',
      },
    ];
    const result = deduplicateShops(shops);
    assert.strictEqual(result.length, 2);
  });

  it('should prefer chain/manual source over osm when merging', () => {
    const shops = [
      { id: 'osm-1', name: 'Shop OSM', lat: 34.0, lng: -118.0, source: 'osm', website: null },
      {
        id: 'chain-1',
        name: 'Shop Chain',
        lat: 34.0,
        lng: -118.0,
        source: 'chain',
        website: 'https://example.com',
      },
    ];
    const result = deduplicateShops(shops);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'chain-1');
    assert.strictEqual(result[0].website, 'https://example.com');
  });

  it('should merge data from both records', () => {
    const shops = [
      { id: '1', name: 'Shop A', lat: 34.0, lng: -118.0, source: 'osm', phone: '555-1234' },
      {
        id: '2',
        name: 'Shop A',
        lat: 34.0,
        lng: -118.0,
        source: 'chain',
        website: 'https://example.com',
      },
    ];
    const result = deduplicateShops(shops);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].phone, '555-1234');
    assert.strictEqual(result[0].website, 'https://example.com');
  });
});
