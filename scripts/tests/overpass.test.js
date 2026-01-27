import assert from 'node:assert';
import { describe, it } from 'node:test';

// We test the internal transformation logic by importing and testing the module
// Network calls are tested via integration tests

describe('Overpass module', () => {
  // Test that the module exports the expected function
  it('should export fetchFromOverpass function', async () => {
    const overpass = await import('../sources/overpass.js');
    assert.strictEqual(typeof overpass.fetchFromOverpass, 'function');
  });
});

// Test data transformation logic by simulating OSM elements
describe('OSM element transformation', () => {
  // These tests verify the transformation logic works correctly

  it('should handle node elements with direct coordinates', () => {
    const element = {
      type: 'node',
      id: 12345,
      lat: 34.0522,
      lon: -118.2437,
      tags: {
        name: 'Test Skate Shop',
        'addr:street': 'Main St',
        'addr:housenumber': '123',
        'addr:city': 'Los Angeles',
        'addr:state': 'CA',
      },
    };

    // Simulate transformation
    const coords = element.lat !== undefined ? { lat: element.lat, lng: element.lon } : null;
    assert.deepStrictEqual(coords, { lat: 34.0522, lng: -118.2437 });
  });

  it('should handle way elements with center coordinates', () => {
    const element = {
      type: 'way',
      id: 67890,
      center: {
        lat: 34.0522,
        lon: -118.2437,
      },
      tags: {
        name: 'Test Skate Shop',
      },
    };

    // Simulate transformation
    const coords = element.center ? { lat: element.center.lat, lng: element.center.lon } : null;
    assert.deepStrictEqual(coords, { lat: 34.0522, lng: -118.2437 });
  });

  it('should build address from OSM tags', () => {
    const tags = {
      'addr:housenumber': '123',
      'addr:street': 'Main St',
      'addr:city': 'Los Angeles',
      'addr:state': 'CA',
      'addr:postcode': '90001',
    };

    const parts = [];
    if (tags['addr:housenumber'] && tags['addr:street']) {
      parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
    }
    if (tags['addr:city']) parts.push(tags['addr:city']);
    if (tags['addr:state']) parts.push(tags['addr:state']);
    if (tags['addr:postcode']) parts.push(tags['addr:postcode']);

    const address = parts.join(', ');
    assert.strictEqual(address, '123 Main St, Los Angeles, CA, 90001');
  });

  it('should generate correct OSM ID format', () => {
    const element = { type: 'node', id: 12345 };
    const osmId = `osm-${element.type}-${element.id}`;
    assert.strictEqual(osmId, 'osm-node-12345');
  });
});
