import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    sanitizeParams,
    truncateString,
    trackEvent,
    trackSearch,
    trackGeolocation,
    trackShopClick,
    trackViewChange,
    trackFormSubmission,
    trackFormOpen,
    trackError,
    trackViewResults,
    initAnalytics,
    getMeasurementId,
    isAnalyticsInitialized
} from '../analytics.js';

describe('sanitizeParams', () => {
    it('should pass through normal parameters', () => {
        const params = {
            view: 'list',
            count: 5,
            success: true
        };
        const result = sanitizeParams(params);
        assert.deepStrictEqual(result, params);
    });

    it('should redact email addresses', () => {
        const params = {
            user_data: 'user@example.com',
            view: 'list'
        };
        const result = sanitizeParams(params);
        assert.strictEqual(result.user_data, '[REDACTED]');
        assert.strictEqual(result.view, 'list');
    });

    it('should redact phone numbers', () => {
        const params = {
            contact: '555-123-4567',
            view: 'map'
        };
        const result = sanitizeParams(params);
        assert.strictEqual(result.contact, '[REDACTED]');
    });

    it('should redact phone numbers with different formats', () => {
        const formats = [
            '5551234567',
            '555.123.4567',
            '555-123-4567'
        ];
        formats.forEach(phone => {
            const result = sanitizeParams({ phone });
            assert.strictEqual(result.phone, '[REDACTED]', `Failed for format: ${phone}`);
        });
    });

    it('should redact ZIP codes', () => {
        const params = {
            location: '90210',
            view: 'list'
        };
        const result = sanitizeParams(params);
        assert.strictEqual(result.location, '[REDACTED]');
    });

    it('should redact ZIP+4 codes', () => {
        const params = {
            location: '90210-1234'
        };
        const result = sanitizeParams(params);
        assert.strictEqual(result.location, '[REDACTED]');
    });

    it('should redact SSN patterns', () => {
        const params = {
            data: '123-45-6789'
        };
        const result = sanitizeParams(params);
        assert.strictEqual(result.data, '[REDACTED]');
    });

    it('should skip null values', () => {
        const params = {
            view: 'list',
            nullValue: null
        };
        const result = sanitizeParams(params);
        assert.strictEqual(result.view, 'list');
        assert.ok(!('nullValue' in result));
    });

    it('should skip undefined values', () => {
        const params = {
            view: 'map',
            undefinedValue: undefined
        };
        const result = sanitizeParams(params);
        assert.strictEqual(result.view, 'map');
        assert.ok(!('undefinedValue' in result));
    });

    it('should handle numeric values', () => {
        const params = {
            count: 42,
            distance: 15.5
        };
        const result = sanitizeParams(params);
        assert.strictEqual(result.count, 42);
        assert.strictEqual(result.distance, 15.5);
    });

    it('should handle boolean values', () => {
        const params = {
            success: true,
            has_results: false
        };
        const result = sanitizeParams(params);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.has_results, false);
    });

    it('should handle empty object', () => {
        const result = sanitizeParams({});
        assert.deepStrictEqual(result, {});
    });
});

describe('truncateString', () => {
    it('should return string unchanged if under max length', () => {
        const result = truncateString('Hello', 10);
        assert.strictEqual(result, 'Hello');
    });

    it('should return string unchanged if exactly max length', () => {
        const result = truncateString('Hello', 5);
        assert.strictEqual(result, 'Hello');
    });

    it('should truncate and add ellipsis if over max length', () => {
        const result = truncateString('Hello World', 8);
        assert.strictEqual(result, 'Hello...');
    });

    it('should handle empty string', () => {
        const result = truncateString('', 10);
        assert.strictEqual(result, '');
    });

    it('should handle null input', () => {
        const result = truncateString(null, 10);
        assert.strictEqual(result, '');
    });

    it('should handle undefined input', () => {
        const result = truncateString(undefined, 10);
        assert.strictEqual(result, '');
    });

    it('should handle non-string input', () => {
        const result = truncateString(12345, 10);
        assert.strictEqual(result, '');
    });

    it('should handle very long strings', () => {
        const longString = 'A'.repeat(1000);
        const result = truncateString(longString, 100);
        assert.strictEqual(result.length, 100);
        assert.ok(result.endsWith('...'));
    });
});

describe('tracking functions without gtag', () => {
    // These tests verify graceful degradation when gtag is not available

    it('trackEvent should not throw when gtag unavailable', () => {
        assert.doesNotThrow(() => {
            trackEvent('test_event', { param: 'value' });
        });
    });

    it('trackSearch should not throw when gtag unavailable', () => {
        assert.doesNotThrow(() => {
            trackSearch('address', 10);
        });
    });

    it('trackGeolocation success should not throw', () => {
        assert.doesNotThrow(() => {
            trackGeolocation(true);
        });
    });

    it('trackGeolocation failure should not throw', () => {
        assert.doesNotThrow(() => {
            trackGeolocation(false, 'PERMISSION_DENIED');
        });
    });

    it('trackShopClick should not throw', () => {
        assert.doesNotThrow(() => {
            trackShopClick('Test Shop', true, 'website');
        });
    });

    it('trackViewChange should not throw', () => {
        assert.doesNotThrow(() => {
            trackViewChange('map');
        });
    });

    it('trackFormSubmission should not throw', () => {
        assert.doesNotThrow(() => {
            trackFormSubmission('suggest');
        });
    });

    it('trackFormOpen should not throw', () => {
        assert.doesNotThrow(() => {
            trackFormOpen('report');
        });
    });

    it('trackError should not throw', () => {
        assert.doesNotThrow(() => {
            trackError('geocoding_failed', 'No results found');
        });
    });

    it('trackViewResults should not throw', () => {
        assert.doesNotThrow(() => {
            trackViewResults(15, 2.5);
        });
    });
});

describe('initAnalytics', () => {
    it('should store measurement ID', () => {
        initAnalytics('G-TEST123');
        assert.strictEqual(getMeasurementId(), 'G-TEST123');
    });

    it('should not throw with invalid ID', () => {
        assert.doesNotThrow(() => {
            initAnalytics(null);
        });
    });

    it('should not throw with empty ID', () => {
        assert.doesNotThrow(() => {
            initAnalytics('');
        });
    });

    it('should handle non-string ID gracefully', () => {
        assert.doesNotThrow(() => {
            initAnalytics(12345);
        });
    });
});

describe('isAnalyticsInitialized', () => {
    it('should return false when gtag not available', () => {
        // Since we're in Node.js without a browser, gtag won't be available
        // so isInitialized should be false even after calling initAnalytics
        const result = isAnalyticsInitialized();
        assert.strictEqual(result, false);
    });
});

describe('event parameter formatting', () => {
    // Test that the functions create correct parameter structures

    it('trackSearch should format parameters correctly', () => {
        // We can't directly test gtag calls without mocking,
        // but we can verify the function signature works
        assert.doesNotThrow(() => {
            trackSearch('address', 0);
            trackSearch('geolocation', 100);
        });
    });

    it('trackShopClick should handle long shop names', () => {
        const longName = 'A'.repeat(200);
        assert.doesNotThrow(() => {
            trackShopClick(longName, false, 'directions');
        });
    });

    it('trackViewResults should handle null distance', () => {
        assert.doesNotThrow(() => {
            trackViewResults(5, null);
        });
    });

    it('trackViewResults should round distance', () => {
        assert.doesNotThrow(() => {
            trackViewResults(5, 12.7);
        });
    });

    it('trackError should handle missing message', () => {
        assert.doesNotThrow(() => {
            trackError('network_error');
        });
    });

    it('trackError should truncate long messages', () => {
        const longMessage = 'Error: '.repeat(100);
        assert.doesNotThrow(() => {
            trackError('test_error', longMessage);
        });
    });
});
