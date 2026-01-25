import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyShop, classifyShops, detectPotentialChains } from '../processors/classifier.js';

describe('classifyShop', () => {
  it('should classify unknown shop as independent', () => {
    const shop = { id: '1', name: 'Local Skate Shop' };
    const result = classifyShop(shop);
    assert.strictEqual(result.isIndependent, true);
    assert.strictEqual(result.chainName, undefined);
  });

  it('should classify Zumiez as chain', () => {
    const shop = { id: '1', name: 'Zumiez - Mall Location' };
    const result = classifyShop(shop);
    assert.strictEqual(result.isIndependent, false);
    assert.strictEqual(result.chainName, 'Zumiez');
  });

  it('should classify zumiez case-insensitively', () => {
    const shop = { id: '1', name: 'ZUMIEZ Store' };
    const result = classifyShop(shop);
    assert.strictEqual(result.isIndependent, false);
    assert.strictEqual(result.chainName, 'Zumiez');
  });

  it('should classify Vans store as chain', () => {
    const shop = { id: '1', name: 'Vans Store' };
    const result = classifyShop(shop);
    assert.strictEqual(result.isIndependent, false);
    assert.strictEqual(result.chainName, 'Vans');
  });

  it('should classify Tactics as chain', () => {
    const shop = { id: '1', name: 'Tactics Boardshop' };
    const result = classifyShop(shop);
    assert.strictEqual(result.isIndependent, false);
    assert.strictEqual(result.chainName, 'Tactics');
  });

  it('should classify CCS as chain', () => {
    const shop = { id: '1', name: 'CCS Skate Shop' };
    const result = classifyShop(shop);
    assert.strictEqual(result.isIndependent, false);
    assert.strictEqual(result.chainName, 'CCS');
  });

  it('should classify Tillys as chain', () => {
    const shop = { id: '1', name: "Tilly's" };
    const result = classifyShop(shop);
    assert.strictEqual(result.isIndependent, false);
    assert.strictEqual(result.chainName, "Tilly's");
  });

  it('should classify by website domain', () => {
    const shop = { id: '1', name: 'Some Store', website: 'https://www.zumiez.com/store/123' };
    const result = classifyShop(shop);
    assert.strictEqual(result.isIndependent, false);
  });

  it('should preserve existing classification', () => {
    const shop = { id: '1', name: 'Known Chain', isIndependent: false, chainName: 'Custom Chain' };
    const result = classifyShop(shop);
    assert.strictEqual(result.isIndependent, false);
    assert.strictEqual(result.chainName, 'Custom Chain');
  });

  it('should not misclassify shops with chain-like words', () => {
    const shop = { id: '1', name: 'Vanguard Skateboards' };
    const result = classifyShop(shop);
    assert.strictEqual(result.isIndependent, true);
  });
});

describe('classifyShops', () => {
  it('should classify all shops in array', () => {
    const shops = [
      { id: '1', name: 'Local Shop' },
      { id: '2', name: 'Zumiez Store' },
      { id: '3', name: 'Another Local' },
    ];
    const result = classifyShops(shops);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].isIndependent, true);
    assert.strictEqual(result[1].isIndependent, false);
    assert.strictEqual(result[2].isIndependent, true);
  });
});

describe('detectPotentialChains', () => {
  it('should detect shops with same name in multiple cities', () => {
    const shops = [
      { id: '1', name: 'Cool Skate', address: '123 Main, Los Angeles, CA' },
      { id: '2', name: 'Cool Skate', address: '456 Oak, San Francisco, CA' },
      { id: '3', name: 'Unique Shop', address: '789 Pine, Seattle, WA' },
    ];
    const result = detectPotentialChains(shops);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'cool skate');
    assert.strictEqual(result[0].locationCount, 2);
  });

  it('should not flag shops in same city as potential chains', () => {
    const shops = [
      { id: '1', name: 'Local Shop', address: '123 Main, Los Angeles, CA' },
      { id: '2', name: 'Local Shop', address: '456 Oak, Los Angeles, CA' },
    ];
    const result = detectPotentialChains(shops);
    assert.strictEqual(result.length, 0);
  });

  it('should sort by location count descending', () => {
    const shops = [
      { id: '1', name: 'Small Chain', address: '1, City A, CA' },
      { id: '2', name: 'Small Chain', address: '2, City B, CA' },
      { id: '3', name: 'Big Chain', address: '3, City C, CA' },
      { id: '4', name: 'Big Chain', address: '4, City D, CA' },
      { id: '5', name: 'Big Chain', address: '5, City E, CA' },
    ];
    const result = detectPotentialChains(shops);
    assert.strictEqual(result[0].name, 'big chain');
    assert.strictEqual(result[0].locationCount, 3);
  });
});
