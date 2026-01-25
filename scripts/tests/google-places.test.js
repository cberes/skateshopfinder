import { describe, it } from 'node:test';
import assert from 'node:assert';
import { transformPlace, US_METRO_AREAS, SEARCH_QUERIES } from '../sources/google-places.js';

describe('transformPlace', () => {
  describe('valid places', () => {
    it('should transform a complete place object', () => {
      const place = {
        id: 'abc123',
        displayName: { text: 'Cool Skate Shop' },
        formattedAddress: '123 Main St, Los Angeles, CA 90001',
        location: { latitude: 34.0522, longitude: -118.2437 },
        websiteUri: 'https://coolskateshop.com',
        nationalPhoneNumber: '(555) 123-4567',
        types: ['store', 'point_of_interest'],
        businessStatus: 'OPERATIONAL',
      };
      const result = transformPlace(place);

      assert.strictEqual(result.id, 'google-abc123');
      assert.strictEqual(result.name, 'Cool Skate Shop');
      assert.strictEqual(result.address, '123 Main St, Los Angeles, CA 90001');
      assert.strictEqual(result.lat, 34.0522);
      assert.strictEqual(result.lng, -118.2437);
      assert.strictEqual(result.website, 'https://coolskateshop.com');
      assert.strictEqual(result.phone, '(555) 123-4567');
      assert.strictEqual(result.source, 'google-places');
      assert.strictEqual(result.googlePlaceId, 'abc123');
      assert.deepStrictEqual(result.types, ['store', 'point_of_interest']);
    });

    it('should handle place with minimal required fields', () => {
      const place = {
        id: 'xyz789',
        displayName: { text: 'Basic Shop' },
        location: { latitude: 40.7128, longitude: -74.0060 },
      };
      const result = transformPlace(place);

      assert.strictEqual(result.id, 'google-xyz789');
      assert.strictEqual(result.name, 'Basic Shop');
      assert.strictEqual(result.lat, 40.7128);
      assert.strictEqual(result.lng, -74.0060);
      assert.strictEqual(result.address, null);
      assert.strictEqual(result.website, null);
      assert.strictEqual(result.phone, null);
    });

    it('should handle missing displayName text gracefully', () => {
      const place = {
        id: 'test1',
        displayName: {},
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result.name, 'Unknown');
    });

    it('should handle missing displayName object gracefully', () => {
      const place = {
        id: 'test2',
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result.name, 'Unknown');
    });

    it('should handle OPERATIONAL business status', () => {
      const place = {
        id: 'op1',
        displayName: { text: 'Open Shop' },
        location: { latitude: 34.0, longitude: -118.0 },
        businessStatus: 'OPERATIONAL',
      };
      const result = transformPlace(place);
      assert.notStrictEqual(result, null);
    });

    it('should handle missing business status (assume operational)', () => {
      const place = {
        id: 'no-status',
        displayName: { text: 'Shop Without Status' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.notStrictEqual(result, null);
    });
  });

  describe('invalid places', () => {
    it('should return null for CLOSED_TEMPORARILY status', () => {
      const place = {
        id: 'closed1',
        displayName: { text: 'Closed Shop' },
        location: { latitude: 34.0, longitude: -118.0 },
        businessStatus: 'CLOSED_TEMPORARILY',
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should return null for CLOSED_PERMANENTLY status', () => {
      const place = {
        id: 'closed2',
        displayName: { text: 'Permanently Closed' },
        location: { latitude: 34.0, longitude: -118.0 },
        businessStatus: 'CLOSED_PERMANENTLY',
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should return null for missing location', () => {
      const place = {
        id: 'no-loc',
        displayName: { text: 'No Location Shop' },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should return null for missing latitude', () => {
      const place = {
        id: 'no-lat',
        displayName: { text: 'No Lat Shop' },
        location: { longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should return null for missing longitude', () => {
      const place = {
        id: 'no-lng',
        displayName: { text: 'No Lng Shop' },
        location: { latitude: 34.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });
  });

  describe('skip patterns (non-skateshops)', () => {
    it('should skip fingerboard shops', () => {
      const place = {
        id: 'fb1',
        displayName: { text: 'Fingerboard World' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip finger board shops (two words)', () => {
      const place = {
        id: 'fb2',
        displayName: { text: 'Finger Board Emporium' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip tech deck stores', () => {
      const place = {
        id: 'td1',
        displayName: { text: 'Tech Deck Store' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip mini skate shops', () => {
      const place = {
        id: 'mini1',
        displayName: { text: 'Mini Skate World' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip ice skating rinks', () => {
      const place = {
        id: 'ice1',
        displayName: { text: 'City Ice Skate Rink' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip ice rinks', () => {
      const place = {
        id: 'ice2',
        displayName: { text: 'Downtown Ice Rink' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip roller skating rinks', () => {
      const place = {
        id: 'roller1',
        displayName: { text: 'Roller Skate Palace' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip roller rinks', () => {
      const place = {
        id: 'roller2',
        displayName: { text: 'Classic Roller Rink' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip skating rinks', () => {
      const place = {
        id: 'rink1',
        displayName: { text: 'Fun Skating Rink' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip figure skating venues', () => {
      const place = {
        id: 'fig1',
        displayName: { text: 'Figure Skating Academy' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should be case-insensitive for skip patterns', () => {
      const place = {
        id: 'case1',
        displayName: { text: 'FINGERBOARD SHOP' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should not skip legitimate skateshops', () => {
      const legitimateNames = [
        'Skateboard City',
        'Pro Skate Shop',
        'Board Riders',
        'Thrasher Supply',
        'Deck Warehouse',
        'Skate Everything',
      ];

      for (const name of legitimateNames) {
        const place = {
          id: `legit-${name}`,
          displayName: { text: name },
          location: { latitude: 34.0, longitude: -118.0 },
        };
        const result = transformPlace(place);
        assert.notStrictEqual(result, null, `Should not skip: ${name}`);
      }
    });

    // Hockey / ice skating stores (common false positives)
    it('should skip hockey stores', () => {
      const place = {
        id: 'hockey1',
        displayName: { text: 'Pure Hockey' },
        location: { latitude: 42.8864, longitude: -78.8784 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip hockey supply stores', () => {
      const place = {
        id: 'hockey2',
        displayName: { text: 'Great Skate Hockey Supply Co.' },
        location: { latitude: 42.8864, longitude: -78.8784 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip figure skater stores', () => {
      const place = {
        id: 'fig2',
        displayName: { text: "The Skater's Edge" },
        location: { latitude: 42.8864, longitude: -78.8784 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip skate sharpening services', () => {
      const place = {
        id: 'sharp1',
        displayName: { text: 'Pro Skate Sharpening' },
        location: { latitude: 42.8864, longitude: -78.8784 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip synthetic ice sellers', () => {
      const place = {
        id: 'synth1',
        displayName: { text: 'Skate Anytime' },
        location: { latitude: 42.8864, longitude: -78.8784 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip roller derby shops', () => {
      const place = {
        id: 'derby1',
        displayName: { text: 'Roller Derby Supplies' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip big box sporting goods stores', () => {
      const stores = [
        "Dick's Sporting Goods",
        'Big 5 Sporting Goods',
        'Academy Sports',
      ];

      for (const name of stores) {
        const place = {
          id: `bigbox-${name}`,
          displayName: { text: name },
          location: { latitude: 34.0, longitude: -118.0 },
        };
        const result = transformPlace(place);
        assert.strictEqual(result, null, `Should skip: ${name}`);
      }
    });

    it('should skip ice arenas and centers', () => {
      const venues = [
        'Buffalo Ice Arena',
        'Community Ice Center',
        'Northtown Ice Centre',
      ];

      for (const name of venues) {
        const place = {
          id: `venue-${name}`,
          displayName: { text: name },
          location: { latitude: 42.8864, longitude: -78.8784 },
        };
        const result = transformPlace(place);
        assert.strictEqual(result, null, `Should skip: ${name}`);
      }
    });

    it('should skip Front Row Sports (hockey retailer)', () => {
      const place = {
        id: 'front-row',
        displayName: { text: 'Front Row Sports' },
        location: { latitude: 42.8287865, longitude: -78.7544297 },
        types: ['sporting_goods_store', 'store', 'point_of_interest', 'establishment'],
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip Front Row Sport (singular)', () => {
      const place = {
        id: 'front-row-2',
        displayName: { text: 'Front Row Sport' },
        location: { latitude: 42.994415, longitude: -78.7826529 },
        types: ['sporting_goods_store', 'store', 'point_of_interest', 'establishment'],
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });
  });

  describe('skateboard type allowlist', () => {
    it('should include skateboard_park with store type (park with attached shop)', () => {
      const place = {
        id: 'food-court',
        displayName: { text: 'Food Court Skatepark' },
        location: { latitude: 42.7160, longitude: -78.8297 },
        types: ['skateboard_park', 'sporting_goods_store', 'store', 'point_of_interest'],
      };
      const result = transformPlace(place);
      assert.notStrictEqual(result, null);
      assert.strictEqual(result.name, 'Food Court Skatepark');
    });

    it('should include skateboard_park with store type even if name matches skip pattern', () => {
      // Hypothetical edge case: a skateboard park with "rink" in the name but has a store
      const place = {
        id: 'skate-rink-park',
        displayName: { text: 'Skate Rink and Park' },
        location: { latitude: 34.0, longitude: -118.0 },
        types: ['skateboard_park', 'store', 'point_of_interest'],
      };
      const result = transformPlace(place);
      assert.notStrictEqual(result, null);
    });

    it('should exclude skateboard_park without store type (public park only)', () => {
      const place = {
        id: 'lasalle',
        displayName: { text: 'LaSalle Skate Park' },
        location: { latitude: 42.7500, longitude: -78.8300 },
        types: ['skateboard_park', 'park', 'point_of_interest'],
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should exclude skateboard_park with only sports_complex type', () => {
      const place = {
        id: 'public-park',
        displayName: { text: 'City Skatepark' },
        location: { latitude: 34.0, longitude: -118.0 },
        types: ['skateboard_park', 'sports_complex', 'point_of_interest'],
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should include skateboard_shop type regardless of other filters', () => {
      const place = {
        id: 'sk8-shop',
        displayName: { text: 'Generic Sports Store' },
        location: { latitude: 34.0, longitude: -118.0 },
        types: ['skateboard_shop', 'sporting_goods_store'],
      };
      const result = transformPlace(place);
      assert.notStrictEqual(result, null);
    });

    it('should include skateboard_shop even without store type', () => {
      const place = {
        id: 'sk8-shop-only',
        displayName: { text: 'Board Shop' },
        location: { latitude: 34.0, longitude: -118.0 },
        types: ['skateboard_shop', 'point_of_interest'],
      };
      const result = transformPlace(place);
      assert.notStrictEqual(result, null);
    });

    it('should still filter non-skateboard sporting goods stores', () => {
      const place = {
        id: 'dicks1',
        displayName: { text: "Dick's Sporting Goods" },
        location: { latitude: 34.0, longitude: -118.0 },
        types: ['sporting_goods_store', 'store', 'point_of_interest'],
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });
  });

  describe('type-based filtering', () => {
    it('should skip places typed as ice_skating_rink', () => {
      const place = {
        id: 'rink-type1',
        displayName: { text: 'Some Generic Name' },
        location: { latitude: 42.8864, longitude: -78.8784 },
        types: ['ice_skating_rink', 'point_of_interest'],
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip places typed as skating_rink', () => {
      const place = {
        id: 'rink-type2',
        displayName: { text: 'Fun Times' },
        location: { latitude: 34.0, longitude: -118.0 },
        types: ['skating_rink', 'establishment'],
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip places typed as stadium', () => {
      const place = {
        id: 'stadium1',
        displayName: { text: 'Sports Arena' },
        location: { latitude: 34.0, longitude: -118.0 },
        types: ['stadium', 'establishment'],
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should skip places typed as arena', () => {
      const place = {
        id: 'arena1',
        displayName: { text: 'Community Center' },
        location: { latitude: 34.0, longitude: -118.0 },
        types: ['arena', 'establishment'],
      };
      const result = transformPlace(place);
      assert.strictEqual(result, null);
    });

    it('should not skip places with generic types like store', () => {
      const place = {
        id: 'store1',
        displayName: { text: 'Local Skate Shop' },
        location: { latitude: 34.0, longitude: -118.0 },
        types: ['store', 'point_of_interest', 'establishment'],
      };
      const result = transformPlace(place);
      assert.notStrictEqual(result, null);
    });

    it('should handle places with no types array', () => {
      const place = {
        id: 'no-types',
        displayName: { text: 'Skate World' },
        location: { latitude: 34.0, longitude: -118.0 },
      };
      const result = transformPlace(place);
      assert.notStrictEqual(result, null);
    });
  });
});

describe('SEARCH_QUERIES', () => {
  it('should include multiple search queries for better coverage', () => {
    assert.ok(SEARCH_QUERIES.length >= 2, 'Should have at least 2 search queries');
  });

  it('should include skate shop query', () => {
    assert.ok(SEARCH_QUERIES.includes('skate shop'), 'Should include "skate shop"');
  });

  it('should include skateboard shop query', () => {
    assert.ok(SEARCH_QUERIES.includes('skateboard shop'), 'Should include "skateboard shop"');
  });
});

describe('US_METRO_AREAS', () => {
  it('should have at least 200 metro areas for good coverage', () => {
    assert.ok(US_METRO_AREAS.length >= 200, `Expected at least 200 metros, got ${US_METRO_AREAS.length}`);
  });

  it('should have all required fields for each metro', () => {
    for (const metro of US_METRO_AREAS) {
      assert.ok(metro.name, `Metro missing name: ${JSON.stringify(metro)}`);
      assert.ok(typeof metro.lat === 'number', `Metro ${metro.name} missing valid lat`);
      assert.ok(typeof metro.lng === 'number', `Metro ${metro.name} missing valid lng`);
    }
  });

  it('should have valid US latitude bounds (18-72, includes Hawaii/Alaska)', () => {
    for (const metro of US_METRO_AREAS) {
      assert.ok(metro.lat >= 18 && metro.lat <= 72, `Metro ${metro.name} lat ${metro.lat} outside US bounds`);
    }
  });

  it('should have valid US longitude bounds (-180 to -65)', () => {
    for (const metro of US_METRO_AREAS) {
      assert.ok(metro.lng >= -180 && metro.lng <= -65, `Metro ${metro.name} lng ${metro.lng} outside US bounds`);
    }
  });

  it('should include major cities', () => {
    const majorCities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
    const metroNames = US_METRO_AREAS.map(m => m.name);

    for (const city of majorCities) {
      assert.ok(metroNames.includes(city), `Missing major city: ${city}`);
    }
  });

  it('should include coverage gap cities', () => {
    const gapCities = ['Missoula', 'Fargo', 'Billings', 'Lubbock', 'Bangor'];
    const metroNames = US_METRO_AREAS.map(m => m.name);

    for (const city of gapCities) {
      assert.ok(metroNames.includes(city), `Missing coverage gap city: ${city}`);
    }
  });

  it('should have no duplicate metro names', () => {
    const names = US_METRO_AREAS.map(m => m.name);
    const uniqueNames = new Set(names);
    assert.strictEqual(names.length, uniqueNames.size, 'Found duplicate metro names');
  });
});
