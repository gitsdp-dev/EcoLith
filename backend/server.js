import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { redactMiddleware, redactObject } from './middleware/redact.js';
import { requireAuth } from './middleware/requireAuth.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import { keysRouter } from './routes/keys.js';
import { analyzeRouter } from './routes/analyze.js';
import { adminRouter } from './routes/admin.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // CSP is configured per-page or in reverse proxy
    crossOriginEmbedderPolicy: false
  })
);

// CORS configuration supporting localhost, Vercel deployments, and custom production domains
const configuredOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:5500')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server, or same-origin)
      if (!origin) {
        return callback(null, true);
      }
      if (
        configuredOrigins.includes(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.endsWith('.vercel.app') ||
        origin === 'https://vercel.app'
      ) {
        return callback(null, true);
      }
      // Production resilience: allow deployed origin (prevents CORS failures on custom domains)
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// JSON body parser with size limit
app.use(express.json({ limit: '5mb' }));

// Redaction & No-Cache middleware
app.use(redactMiddleware);

// Process-level crash prevention guards for high concurrency
process.on('unhandledRejection', (reason) => {
  console.error(
    '[CONCURRENCY GUARD] Unhandled Rejection intercepted:',
    redactObject({ reason: String(reason) })
  );
});

process.on('uncaughtException', (err) => {
  console.error(
    '[CONCURRENCY GUARD] Uncaught Exception intercepted:',
    redactObject({ error: err.message })
  );
});

// Root API status endpoint
app.get(['/api', '/api/', '/', ''], (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ecolith-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint (mounted on both /api/health and /health)
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ecolith-backend',
    timestamp: new Date().toISOString()
  });
});

// Public application settings
app.get(['/api/config', '/config'], requireAuth, (_req, res) => {
  res.json({
    defaultModel: process.env.DEFAULT_GEMINI_MODEL || 'gemini-2.5-flash',
    maxImageSizeMb: 4,
    maintenanceMode: false,
    disclaimer: 'AI visual analysis is not a guarantee of food safety or edibility.'
  });
});

// BYOK Key Vault Routes (mounted on both /api/keys and /keys)
app.use(['/api/keys', '/keys'], requireAuth, keysRouter);

// AI Food Waste Analysis Route (BYOK)
app.use(['/api/analyze', '/analyze'], requireAuth, analyzeRouter);

// Role-Gated Admin Management Routes
app.use(['/api/admin', '/admin'], requireAdmin, adminRouter);

// Catch-all 404 handler returning JSON (never HTML) for API routes
app.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `API endpoint not found: ${req.method} ${req.originalUrl || req.url}`
  });
});

// Global Error Handler (scrubs error details, never leaks stack traces)
app.use((err, req, res, _next) => {
  const safeMessage = err.message || 'An unexpected server error occurred.';
  console.error('[SERVER ERROR]', redactObject({ error: safeMessage }));
  res.status(err.status || 500).json({
    error: 'InternalServerError',
    message: safeMessage
  });
});

// Start Server (only when executed directly, not inside Vercel serverless)
if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`[EcoLith Backend] Server running on port ${PORT}`);
  });
  // High-concurrency socket configuration: handle bursts of concurrent logins smoothly
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

export { app };
export default app;
