import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadChainStores, loadManualAdditions } from '../sources/chains.js';

describe('Chain stores module', () => {
  describe('loadChainStores', () => {
    it('should return an array', async () => {
      const result = await loadChainStores();
      assert.ok(Array.isArray(result));
    });

    it('should return empty array for empty chain-stores.json', async () => {
      // The test data file is currently empty []
      const result = await loadChainStores();
      assert.deepStrictEqual(result, []);
    });
  });

  describe('loadManualAdditions', () => {
    it('should return an array', async () => {
      const result = await loadManualAdditions();
      assert.ok(Array.isArray(result));
    });

    it('should return empty array for empty manual-additions.json', async () => {
      // The test data file is currently empty []
      const result = await loadManualAdditions();
      assert.deepStrictEqual(result, []);
    });
  });
});

describe('Chain name extraction', () => {
  const extractChainName = (name) => {
    if (!name) return null;
    const patterns = [
      /^(Zumiez)/i,
      /^(Vans)/i,
      /^(Tactics)/i,
      /^(CCS)/i,
      /^(Tilly's)/i,
      /^(PacSun)/i,
    ];
    for (const pattern of patterns) {
      const match = name.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  it('should extract Zumiez from store name', () => {
    assert.strictEqual(extractChainName('Zumiez - Mall Location'), 'Zumiez');
  });

  it('should extract Vans from store name', () => {
    assert.strictEqual(extractChainName('Vans Store Downtown'), 'Vans');
  });

  it('should return null for unknown chains', () => {
    assert.strictEqual(extractChainName('Local Skate Shop'), null);
  });

  it('should return null for null input', () => {
    assert.strictEqual(extractChainName(null), null);
  });
});
