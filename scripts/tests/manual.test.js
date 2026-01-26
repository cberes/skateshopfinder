import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadManualAdditions } from '../sources/manual.js';

describe('Manual additions module', () => {
  describe('loadManualAdditions', () => {
    it('should return an array', async () => {
      const result = await loadManualAdditions();
      assert.ok(Array.isArray(result));
    });

    it('should return empty array for empty manual-additions.json', async () => {
      // The data file is currently empty []
      const result = await loadManualAdditions();
      assert.deepStrictEqual(result, []);
    });
  });
});
