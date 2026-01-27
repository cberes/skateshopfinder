import assert from 'node:assert';
import { describe, it } from 'node:test';
import { isWithinUSA } from '../processors/geocoder.js';

describe('isWithinUSA', () => {
  it('should return true for coordinates in Los Angeles', () => {
    assert.strictEqual(isWithinUSA(34.0522, -118.2437), true);
  });

  it('should return true for coordinates in New York', () => {
    assert.strictEqual(isWithinUSA(40.7128, -74.006), true);
  });

  it('should return true for coordinates in Miami', () => {
    assert.strictEqual(isWithinUSA(25.7617, -80.1918), true);
  });

  it('should return true for coordinates in Seattle', () => {
    assert.strictEqual(isWithinUSA(47.6062, -122.3321), true);
  });

  it('should return false for coordinates in Mexico', () => {
    assert.strictEqual(isWithinUSA(19.4326, -99.1332), false);
  });

  it('should return false for coordinates in Canada', () => {
    assert.strictEqual(isWithinUSA(51.0447, -114.0719), false);
  });

  it('should return false for coordinates in Europe', () => {
    assert.strictEqual(isWithinUSA(51.5074, -0.1278), false);
  });

  it('should return true for boundary coordinates (southwest)', () => {
    assert.strictEqual(isWithinUSA(24.5, -125.0), true);
  });

  it('should return true for boundary coordinates (northeast)', () => {
    assert.strictEqual(isWithinUSA(49.5, -66.5), true);
  });

  it('should return false for coordinates just outside boundary', () => {
    assert.strictEqual(isWithinUSA(24.4, -118.0), false);
    assert.strictEqual(isWithinUSA(34.0, -125.1), false);
  });
});
