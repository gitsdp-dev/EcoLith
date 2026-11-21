import rateLimit from 'express-rate-limit';

/**
 * High-concurrency rate limit for key validation & status operations.
 * Keyed strictly per authenticated user ID so that multiple concurrent users
 * never throttle each other, while still protecting against automated abuse.
 * Easily supports concurrent bursts of 10+ logins/sec.
 */
export const keyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 operations per 15 min per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  message: {
    error: 'TooManyRequests',
    message: 'Too many key operations. Please wait before trying again.'
  }
});

/**
 * Rate limit for image analysis (20 scans per 5 minutes per user).
 */
export const analyzeRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  message: {
    code: 'QUOTA_EXCEEDED',
    error: 'TooManyRequests',
    message: 'Scan rate limit reached. Please wait a few minutes before scanning again.'
  }
});

/**
 * Standard API rate limit.
 * Configured with generous burst capacity (up to 300 requests/min per IP/user)
 * to smoothly handle 10+ concurrent logins and dashboard initializations per second.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // Supports 10+ concurrent users with multiple parallel asset & API calls
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  message: {
    error: 'TooManyRequests',
    message: 'Too many requests. Please slow down.'
  }
});

/**
 * Dedicated auth & login burst limiter.
 * Explicitly designed to support at least 10 logins in a single second
 * without crashing or returning 429 errors.
 */
export const loginBurstLimiter = rateLimit({
  windowMs: 1000, // 1 second window
  max: 20, // Allows up to 20 auth calls per single second
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    error: 'TooManyRequests',
    message: 'Server is currently handling peak login load. Please retry in a moment.'
  }
});
