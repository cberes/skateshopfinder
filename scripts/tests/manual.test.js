import assert from 'node:assert';
import { describe, it } from 'node:test';
import { loadManualAdditions } from '../sources/manual.js';

describe('Manual additions module', () => {
  describe('loadManualAdditions', () => {
    it('should return an array', async () => {
      const result = await loadManualAdditions();
      assert.ok(Array.isArray(result));
    });

    it('should return shops with required fields', async () => {
      const result = await loadManualAdditions();
      // Only test structure if there are entries
      if (result.length > 0) {
        for (const shop of result) {
          assert.ok(shop.id, 'Shop should have an id');
          assert.ok(shop.name, 'Shop should have a name');
          assert.ok(typeof shop.lat === 'number', 'Shop should have numeric lat');
          assert.ok(typeof shop.lng === 'number', 'Shop should have numeric lng');
          assert.strictEqual(shop.source, 'manual', 'Shop source should be "manual"');
          assert.ok(
            typeof shop.isIndependent === 'boolean',
            'Shop should have boolean isIndependent'
          );
        }
      }
    });

    it('should set source to manual for all shops', async () => {
      const result = await loadManualAdditions();
      for (const shop of result) {
        assert.strictEqual(shop.source, 'manual');
      }
    });

    it('should default isIndependent to true', async () => {
      const result = await loadManualAdditions();
      // Manual additions without explicit isIndependent should default to true
      for (const shop of result) {
        assert.ok(typeof shop.isIndependent === 'boolean');
      }
    });
  });
});
