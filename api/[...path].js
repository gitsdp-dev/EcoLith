import app from '../backend/server.js';

/**
 * Vercel Serverless Function entry point for catch-all /api/* routes.
 * Dispatches all /api/* sub-path requests (e.g. /api/keys, /api/analyze, /api/admin/*) to Express.
 */
export default app;
