/**
 * Analytics Abstraction Layer
 * Privacy-focused GA4 tracking with graceful degradation
 */

// Store measurement ID for reference
let measurementId = null;
let isInitialized = false;

/**
 * Check if gtag is available (not blocked by ad blockers)
 */
function isGtagAvailable() {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

/**
 * Initialize Google Analytics 4
 * @param {string} id - GA4 Measurement ID (e.g., 'G-XXXXXXXXXX')
 */
export function initAnalytics(id) {
  if (!id || typeof id !== 'string') {
    console.warn('Analytics: Invalid measurement ID');
    return;
  }

  measurementId = id;

  if (isGtagAvailable()) {
    window.gtag('config', measurementId, {
      // Privacy-focused settings
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    isInitialized = true;
  } else {
    console.info('Analytics: gtag not available (may be blocked)');
  }
}

/**
 * Track a generic event
 * @param {string} eventName - Name of the event
 * @param {Object} params - Event parameters (no PII allowed)
 */
export function trackEvent(eventName, params = {}) {
  if (!isGtagAvailable()) return;

  // Sanitize params to prevent PII leakage
  const sanitizedParams = sanitizeParams(params);

  try {
    window.gtag('event', eventName, sanitizedParams);
  } catch (error) {
    console.warn('Analytics: Failed to track event', error);
  }
}

/**
 * Track a search event
 * @param {string} method - Search method ('address' or 'geolocation')
 * @param {number} resultCount - Number of results found
 */
export function trackSearch(method, resultCount) {
  trackEvent('search', {
    method: method,
    result_count: resultCount,
    has_results: resultCount > 0,
  });
}

/**
 * Track geolocation usage
 * @param {boolean} success - Whether geolocation succeeded
 * @param {string} [errorType] - Error type if failed
 */
export function trackGeolocation(success, errorType = null) {
  if (success) {
    trackEvent('geolocation', {
      success: true,
    });
  } else {
    trackEvent('geolocation_error', {
      success: false,
      error_type: errorType || 'unknown',
    });
  }
}

/**
 * Track shop link clicks
 * @param {string} shopName - Name of the shop
 * @param {boolean} isIndependent - Whether shop is independent
 * @param {string} action - Action type ('website', 'directions', or 'phone')
 */
export function trackShopClick(shopName, isIndependent, action) {
  // Truncate shop name to prevent very long values
  const truncatedName = truncateString(shopName, 100);

  trackEvent('shop_click', {
    shop_name: truncatedName,
    is_independent: isIndependent,
    action: action,
  });
}

/**
 * Track view changes (list/map toggle)
 * @param {string} view - Current view ('list' or 'map')
 */
export function trackViewChange(view) {
  trackEvent('view_change', {
    view: view,
  });
}

/**
 * Track form submissions
 * @param {string} formType - Form type ('suggest' or 'report')
 */
export function trackFormSubmission(formType) {
  trackEvent('form_submit', {
    form_type: formType,
  });
}

/**
 * Track form opens
 * @param {string} formType - Form type ('suggest' or 'report')
 */
export function trackFormOpen(formType) {
  trackEvent('form_open', {
    form_type: formType,
  });
}

/**
 * Track errors
 * @param {string} errorType - Type of error
 * @param {string} [message] - Error message (sanitized)
 */
export function trackError(errorType, message = null) {
  const params = {
    error_type: errorType,
  };

  if (message) {
    // Truncate and sanitize error message
    params.error_message = truncateString(message, 100);
  }

  trackEvent('error', params);
}

/**
 * Track results display
 * @param {number} resultCount - Number of results
 * @param {number} [nearestDistance] - Distance to nearest shop in miles
 */
export function trackViewResults(resultCount, nearestDistance = null) {
  const params = {
    result_count: resultCount,
  };

  if (nearestDistance !== null) {
    params.nearest_distance = Math.round(nearestDistance);
  }

  trackEvent('view_results', params);
}

/**
 * Sanitize parameters to prevent PII leakage
 * @param {Object} params - Parameters to sanitize
 * @returns {Object} Sanitized parameters
 */
export function sanitizeParams(params) {
  const sanitized = {};
  const piiPatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
    /\b\d{5}(-\d{4})?\b/, // ZIP code
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  ];

  for (const [key, value] of Object.entries(params)) {
    // Skip null/undefined values
    if (value === null || value === undefined) continue;

    // Convert to string for PII checking
    const strValue = String(value);

    // Check for PII patterns
    const containsPII = piiPatterns.some((pattern) => pattern.test(strValue));

    if (containsPII) {
      // Replace with placeholder
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Truncate a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export function truncateString(str, maxLength) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength - 3)}...`;
}

/**
 * Get the current measurement ID
 * @returns {string|null} Current measurement ID
 */
export function getMeasurementId() {
  return measurementId;
}

/**
 * Check if analytics is initialized
 * @returns {boolean} Whether analytics is initialized
 */
export function isAnalyticsInitialized() {
  return isInitialized;
}
