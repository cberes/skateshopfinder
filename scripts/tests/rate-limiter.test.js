import assert from 'node:assert';
import { describe, it } from 'node:test';
import { processWithRateLimit, RateLimiter, withRateLimit } from '../utils/rate-limiter.js';

describe('RateLimiter', () => {
  it('should create a rate limiter with default rate', () => {
    const limiter = new RateLimiter();
    assert.strictEqual(limiter.minInterval, 1000);
  });

  it('should create a rate limiter with custom rate', () => {
    const limiter = new RateLimiter(2);
    assert.strictEqual(limiter.minInterval, 500);
  });

  it('should not delay the first request', async () => {
    const limiter = new RateLimiter(10);
    const start = Date.now();
    await limiter.wait();
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 50, `First request should not wait, but waited ${elapsed}ms`);
  });

  it('should delay subsequent requests', async () => {
    const limiter = new RateLimiter(10); // 100ms interval
    await limiter.wait();
    const start = Date.now();
    await limiter.wait();
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 90, `Should wait at least 90ms, but waited ${elapsed}ms`);
  });
});

describe('withRateLimit', () => {
  it('should wrap a function with rate limiting', async () => {
    const limiter = new RateLimiter(10);
    let callCount = 0;
    const fn = async () => ++callCount;
    const limited = withRateLimit(fn, limiter);

    await limited();
    assert.strictEqual(callCount, 1);

    await limited();
    assert.strictEqual(callCount, 2);
  });

  it('should pass arguments through', async () => {
    const limiter = new RateLimiter(10);
    const fn = async (a, b) => a + b;
    const limited = withRateLimit(fn, limiter);

    const result = await limited(2, 3);
    assert.strictEqual(result, 5);
  });
});

describe('processWithRateLimit', () => {
  it('should process all items', async () => {
    const items = [1, 2, 3];
    const processor = async (x) => x * 2;
    const results = await processWithRateLimit(items, processor, 100);
    assert.deepStrictEqual(results, [2, 4, 6]);
  });

  it('should filter out failed items', async () => {
    const items = [1, 2, 3];
    const processor = async (x) => {
      if (x === 2) throw new Error('test error');
      return x * 2;
    };
    const results = await processWithRateLimit(items, processor, 100);
    assert.deepStrictEqual(results, [2, 6]);
  });
});
