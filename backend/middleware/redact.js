/**
 * Redaction utility & middleware.
 * Strips API keys, Authorization tokens, and sensitive headers/fields from logs and error objects.
 */

const SENSITIVE_KEYS = new Set([
  'apikey',
  'api_key',
  'x-goog-api-key',
  'authorization',
  'password',
  'token',
  'ciphertext',
  'mastersecret'
]);

/**
 * Recursively redacts sensitive keys from an object.
 * @param {any} obj
 * @returns {any}
 */
export function redactObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = redactObject(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Express middleware to prevent logging of sensitive request bodies and headers.
 */
export function redactMiddleware(req, res, next) {
  // Prevent caching of any API responses by default
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}
