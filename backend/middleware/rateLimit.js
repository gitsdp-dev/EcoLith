import rateLimit from 'express-rate-limit';

/**
 * Rate limit for key validation & submission (5 attempts per 15 minutes per user / IP).
 */
export const keyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per authenticated user ID if present, otherwise by IP
    return req.user?.id || req.ip;
  },
  message: {
    error: 'TooManyRequests',
    message: 'Too many key operations. Please wait 15 minutes before trying again.'
  }
});

/**
 * Standard API rate limit.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TooManyRequests',
    message: 'Too many requests. Please slow down.'
  }
});
