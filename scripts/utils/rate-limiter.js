/**
 * Rate limiter utility for API calls
 * Implements a simple token bucket algorithm
 */

export class RateLimiter {
  constructor(requestsPerSecond = 1) {
    this.minInterval = 1000 / requestsPerSecond;
    this.lastRequestTime = 0;
  }

  async wait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const waitTime = Math.max(0, this.minInterval - timeSinceLastRequest);

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

/**
 * Wraps a function with rate limiting
 * @param {Function} fn - Function to wrap
 * @param {RateLimiter} limiter - Rate limiter instance
 * @returns {Function} Rate-limited function
 */
export function withRateLimit(fn, limiter) {
  return async (...args) => {
    await limiter.wait();
    return fn(...args);
  };
}

/**
 * Process items with rate limiting
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} requestsPerSecond - Rate limit
 * @returns {Promise<Array>} Processed items
 */
export async function processWithRateLimit(items, processor, requestsPerSecond = 1) {
  const limiter = new RateLimiter(requestsPerSecond);
  const results = [];

  for (const item of items) {
    await limiter.wait();
    try {
      const result = await processor(item);
      results.push(result);
    } catch (error) {
      console.error(`Error processing item:`, error.message);
      results.push(null);
    }
  }

  return results.filter((r) => r !== null);
}
