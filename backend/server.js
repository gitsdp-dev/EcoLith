import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { redactMiddleware, redactObject } from './middleware/redact.js';
import { requireAuth } from './middleware/requireAuth.js';
import { keysRouter } from './routes/keys.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5500';

// Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false, // CSP is configured per-page or in reverse proxy
  crossOriginEmbedderPolicy: false
}));

// Exact-origin CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin || origin === allowedOrigin || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy violation: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// JSON body parser with size limit
app.use(express.json({ limit: '5mb' }));

// Redaction & No-Cache middleware
app.use(redactMiddleware);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ecolith-backend',
    timestamp: new Date().toISOString()
  });
});

// Public application settings
app.get('/api/config', requireAuth, (req, res) => {
  res.json({
    defaultModel: process.env.DEFAULT_GEMINI_MODEL || 'gemini-2.5-flash',
    maxImageSizeMb: 4,
    maintenanceMode: false,
    disclaimer: 'AI visual analysis is not a guarantee of food safety or edibility.'
  });
});

// BYOK Key Vault Routes
app.use('/api/keys', requireAuth, keysRouter);

// Global Error Handler (scrubs error details, never leaks stack traces)
app.use((err, req, res, next) => {
  const safeMessage = err.message || 'An unexpected server error occurred.';
  console.error('[SERVER ERROR]', redactObject({ error: safeMessage }));
  res.status(err.status || 500).json({
    error: 'InternalServerError',
    message: safeMessage
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[EcoLith Backend] Server running on port ${PORT}`);
});
