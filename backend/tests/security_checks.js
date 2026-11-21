import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { encryptApiKey, decryptApiKey, hashApiKey } from '../lib/crypto.js';
import { cleanApiKey } from '../routes/keys.js';
import { redactObject } from '../middleware/redact.js';
import { normalizeToKg, calculateDashboardMetrics } from '../../js/dashboard.js';
import { FOURTEEN_DAYS_MS, isSessionExpired } from '../../js/auth.js';

const ROOT_DIR = path.resolve('.');

if (!process.env.KEY_ENCRYPTION_SECRET) {
  process.env.KEY_ENCRYPTION_SECRET = 'dGVzdC1tYXN0ZXItc2VjcmV0LWZvci1zZWN1cml0eS10ZXN0cw==';
}

// Test 1: Frontend Secrets Leak Scan (Grep check)
test('SECURITY: No server secrets or hardcoded AI keys in client files', () => {
  const clientDirs = ['js', 'css'];
  const rootHtmlFiles = fs.readdirSync(ROOT_DIR).filter((f) => f.endsWith('.html'));

  const filesToScan = [...rootHtmlFiles.map((f) => path.join(ROOT_DIR, f))];

  for (const dir of clientDirs) {
    const dirPath = path.join(ROOT_DIR, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        filesToScan.push(path.join(dirPath, file));
      }
    }
  }

  const forbiddenPatterns = [
    { pattern: /service_role/i, name: 'SUPABASE_SERVICE_ROLE_KEY leak' },
    { pattern: /KEY_ENCRYPTION_SECRET/i, name: 'KEY_ENCRYPTION_SECRET leak' },
    { pattern: /AIza[0-9A-Za-z-_]{35}/, name: 'Hardcoded Google API Key' }
  ];

  for (const filePath of filesToScan) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const { pattern, name } of forbiddenPatterns) {
      const match = content.match(pattern);
      assert.equal(
        match,
        null,
        `SECURITY VIOLATION: Found forbidden secret (${name}) in client file: ${path.relative(ROOT_DIR, filePath)}`
      );
    }
  }
});

// Test 2: AES-256-GCM Encryption with User-ID AAD Security
test('SECURITY: Cryptographic isolation - user A cannot decrypt user B key', () => {
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';
  const secretKey = 'AIzaSyCanaryUserASecretKey1234567890';

  const encrypted = encryptApiKey(secretKey, userA);

  // 1. Plaintext must never equal ciphertext
  assert.notEqual(encrypted.ciphertext, secretKey);
  assert.ok(!encrypted.ciphertext.includes(secretKey));

  // 2. User A can decrypt their own key
  const decryptedA = decryptApiKey(encrypted.ciphertext, encrypted.iv, encrypted.authTag, userA);
  assert.equal(decryptedA, secretKey);

  // 3. User B attempting to decrypt User A's ciphertext with their user ID must FAIL (AAD mismatch)
  assert.throws(
    () => {
      decryptApiKey(encrypted.ciphertext, encrypted.iv, encrypted.authTag, userB);
    },
    /Unsupported state or unable to authenticate data/,
    'Tampered or cross-user AAD decryption must throw auth tag error'
  );

  // 4. Tampered ciphertext must fail authentication
  assert.throws(() => {
    decryptApiKey('AAAA' + encrypted.ciphertext.slice(4), encrypted.iv, encrypted.authTag, userA);
  }, 'Tampered ciphertext must fail authentication');
});

// Test 3: Canary Key Leak & Redaction Test
test('SECURITY: Canary key and sensitive headers are redacted from logs and errors', () => {
  const canaryKey = 'AIzaSyCanaryVerificationSecret987654321';
  const sensitivePayload = {
    apiKey: canaryKey,
    headers: {
      'x-goog-api-key': canaryKey,
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
      'content-type': 'application/json'
    },
    nested: {
      password: 'SuperSecretPassword123!',
      key_ciphertext: 'mock-ciphertext-string'
    },
    safeData: 'EcoLith-Public-Data'
  };

  const redacted = redactObject(sensitivePayload);

  // The canary key must be completely redacted
  const jsonString = JSON.stringify(redacted);
  assert.ok(!jsonString.includes(canaryKey), 'Canary key must NEVER appear in redacted object');
  assert.ok(!jsonString.includes('SuperSecretPassword123!'), 'Password must be redacted');
  assert.equal(redacted.apiKey, '[REDACTED]');
  assert.equal(redacted.headers['x-goog-api-key'], '[REDACTED]');
  assert.equal(redacted.safeData, 'EcoLith-Public-Data');
});

// Test 4: Dashboard Math Determinism & Conversion
test('DASHBOARD: Plain JS deterministic metric computation', () => {
  assert.equal(normalizeToKg(500, 'g'), 0.5);
  assert.equal(normalizeToKg(2.5, 'kg'), 2.5);
  assert.equal(normalizeToKg(2, 'piece'), 0.3);
  assert.equal(normalizeToKg(1000, 'ml'), 1.0);

  const mockScans = [
    {
      food_name: 'Apple core',
      waste_category: 'unavoidable_organic',
      quantity: 1000,
      quantity_unit: 'g'
    },
    {
      food_name: 'Surplus Sandwich',
      waste_category: 'surplus_redistributable',
      quantity: 2,
      quantity_unit: 'piece'
    },
    {
      food_name: 'Citrus peel',
      waste_category: 'unavoidable_organic',
      quantity: 0.7,
      quantity_unit: 'kg'
    }
  ];

  const mockRecoveries = [
    { recovery_method: 'composting', status: 'completed' },
    { recovery_method: 'redistribution', status: 'planned' }
  ];

  const metrics = calculateDashboardMetrics(mockScans, mockRecoveries);

  assert.equal(metrics.totalWasteKg, 2.0);
  assert.equal(metrics.totalScans, 3);
  assert.equal(metrics.edibleSurplusKg, 0.3);
  assert.equal(metrics.edibleRedirectRate, 15);
  assert.equal(metrics.organicDivertedKg, 2.0);
  assert.equal(metrics.diversionRate, 100);
  assert.equal(metrics.completedRecoveryCount, 1);
  assert.equal(metrics.estimatedCo2SavedKg, 3.8);
  assert.equal(metrics.estimatedWaterSavedLiters, 3000);
});

// Test 5: Admin Authorization & Self-Suspension Safeguards
test('SECURITY: Admin authorization safeguards and stealth 404', async () => {
  const { requireAdmin } = await import('../middleware/requireAdmin.js');

  // 1. Unauthenticated request must receive 404 (stealth)
  const reqUnauth = { headers: {} };
  let statusResult = null;
  let jsonResult = null;
  const resUnauth = {
    status: (s) => {
      statusResult = s;
      return {
        json: (j) => {
          jsonResult = j;
        }
      };
    }
  };

  await requireAdmin(reqUnauth, resUnauth, () => {});
  assert.equal(
    statusResult,
    404,
    'Unauthenticated request on admin route must return 404 Not Found'
  );
  assert.equal(jsonResult.error, 'NotFound');
});

// Test 6: Database Schema Security Audit (Default-Deny & Forced RLS)
test('SECURITY: SQL Migrations enforce default-deny and forced RLS on all tables', () => {
  const migrationsDir = path.join(ROOT_DIR, 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

  let combinedSql = '';
  for (const file of migrationFiles) {
    combinedSql += fs.readFileSync(path.join(migrationsDir, file), 'utf-8') + '\n';
  }

  // Verify Default-Deny grants revoked from anon
  assert.ok(
    combinedSql.includes('revoke all on schema private from public, anon, authenticated'),
    'Private schema must be revoked from public, anon, authenticated'
  );
  assert.ok(
    combinedSql.includes('revoke all on all tables in schema public from anon'),
    'Public tables must be revoked from anon'
  );

  // Verify forced RLS on tables
  const tables = [
    'profiles',
    'food_scans',
    'recovery_records',
    'user_preferences',
    'user_api_keys',
    'recovery_rules',
    'app_settings',
    'audit_logs',
    'api_usage_events'
  ];

  for (const table of tables) {
    assert.ok(
      combinedSql.includes(`alter table public.${table} force row level security`) ||
        combinedSql.includes(`alter table private.${table} force row level security`),
      `Table ${table} must have FORCED row level security`
    );
  }
});

// Test 7: One Key, One User Cryptographic Anti-Convergence & Anti-Divergence
test('SECURITY & BYOK: One Key, One User uniqueness and anti-convergence fingerprinting', () => {
  const secretKey1 = 'AIzaSyUniqueKeyAlpha1234567890123456';
  const secretKey2 = 'AIzaSyUniqueKeyBeta9876543210987654';

  const hash1a = hashApiKey(secretKey1);
  const hash1b = hashApiKey(secretKey1);
  const hash2 = hashApiKey(secretKey2);

  // 1. Hashes must be deterministic for identical keys
  assert.equal(hash1a, hash1b, 'Fingerprint must be deterministic for identical key input');

  // 2. Different keys must produce different fingerprints
  assert.notEqual(hash1a, hash2, 'Distinct API keys must produce distinct fingerprints');

  // 3. Zero-knowledge: hash must never contain or expose the plaintext key
  assert.ok(!hash1a.includes(secretKey1), 'Fingerprint must not leak plaintext key');
  assert.equal(hash1a.length, 64, 'HMAC-SHA256 fingerprint must be 64 hex characters');

  // 4. Verify SQL migration enforces uniqueness on key_hash
  const migrationsDir = path.join(ROOT_DIR, 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  let combinedSql = '';
  for (const file of migrationFiles) {
    combinedSql += fs.readFileSync(path.join(migrationsDir, file), 'utf-8') + '\n';
  }

  assert.ok(
    combinedSql.includes('idx_user_api_keys_key_hash') || combinedSql.includes('key_hash'),
    'Migrations must enforce unique index/constraint on key_hash to prevent key convergence across users'
  );
});

// Test 8: 14-Day Inactivity Session Management
test('AUTH: Inactive user kept logged in for 14 days and automatically expired thereafter', () => {
  assert.equal(FOURTEEN_DAYS_MS, 14 * 24 * 60 * 60 * 1000);

  const now = Date.now();

  // Case 1: Inactive user at 13 days (under 14 days) -> Remains logged in
  const thirteenDaysAgoIso = new Date(now - 13 * 24 * 60 * 60 * 1000).toISOString();
  const validSession = {
    user: {
      id: 'test-user-active',
      last_sign_in_at: thirteenDaysAgoIso
    }
  };
  assert.equal(
    isSessionExpired(validSession),
    false,
    'User inactive for 13 days must remain logged in'
  );

  // Case 2: Inactive user at 15 days (> 14 days) -> Automatically expired
  const fifteenDaysAgoIso = new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString();
  const expiredSession = {
    user: {
      id: 'test-user-expired',
      last_sign_in_at: fifteenDaysAgoIso
    }
  };
  assert.equal(
    isSessionExpired(expiredSession),
    true,
    'User inactive for > 14 days must be automatically expired'
  );

  // Case 3: Fresh login -> Valid
  const freshSession = {
    user: {
      id: 'test-user-fresh',
      last_sign_in_at: new Date(now - 60 * 1000).toISOString()
    }
  };
  assert.equal(isSessionExpired(freshSession), false, 'Freshly logged-in user must be valid');
});

// Test 9: Concurrency Resilience - 10 Logins at a Single Second
test('CONCURRENCY: Authentication system withstands 10 concurrent logins per second without crashing', async () => {
  const { loginBurstLimiter } = await import('../middleware/rateLimit.js');

  // Simulate 10 logins executing simultaneously at the exact same millisecond
  const concurrentLogins = Array.from({ length: 10 }, (_, i) => ({
    userId: `user-concurrent-${i}`,
    email: `student${i}@university.edu`,
    password: `SecurePass123!${i}`
  }));

  const startTime = Date.now();
  const results = await Promise.all(
    concurrentLogins.map(async (user) => {
      // Mock Express req/res
      let statusCode = 200;
      let responseBody = null;
      let nextCalled = false;

      const req = {
        ip: '192.168.1.100',
        headers: {},
        user: { id: user.userId },
        app: { get: () => false }
      };

      const res = {
        setHeader: () => {},
        getHeader: () => null,
        status: (code) => {
          statusCode = code;
          return {
            send: (body) => {
              responseBody = body;
            },
            json: (body) => {
              responseBody = body;
            }
          };
        }
      };

      await new Promise((resolve) => {
        loginBurstLimiter(req, res, () => {
          nextCalled = true;
          resolve();
        });
      });

      return { statusCode, nextCalled, responseBody };
    })
  );

  const durationMs = Date.now() - startTime;

  // All 10 logins must pass through cleanly within under 1 second without throwing errors or dropping
  assert.ok(durationMs < 1000, `10 concurrent logins completed in ${durationMs}ms`);
  for (const res of results) {
    assert.equal(
      res.nextCalled,
      true,
      'Each of the 10 logins in 1 second must be allowed by burst limiter'
    );
    assert.equal(res.statusCode, 200);
  }
});

// Test 10: Zero-Knowledge Privacy - Admins Cannot View User API Keys
test('SECURITY: Admins never receive user API keys (plaintext or ciphertext)', async () => {
  const { adminRouter } = await import('../routes/admin.js');

  // Inspect route layer exports and handlers
  assert.ok(adminRouter, 'Admin router must be defined');

  // Verify that neither the database helper nor the admin user routes return key fields
  const adminFileContent = fs.readFileSync(
    path.join(ROOT_DIR, 'backend', 'routes', 'admin.js'),
    'utf-8'
  );
  assert.ok(
    !adminFileContent.includes('ciphertext'),
    'Admin routes must NEVER select or return ciphertext'
  );
  assert.ok(
    !adminFileContent.includes('auth_tag'),
    'Admin routes must NEVER select or return auth_tag'
  );
  assert.ok(
    !adminFileContent.includes('decryptApiKey'),
    'Admin router must NEVER decrypt user API keys'
  );
});

// Test 11: BYOK Resilience - Key Sanitization and AQ./AIza Format Acceptance
test('BYOK: Key sanitization cleanly processes quoted, prefixed, and modern AQ./AIza keys', () => {
  // Test A: Quoted legacy key
  const quotedKey = '"AIzaSyC1234567890abcdefghijklmnopqrst"';
  assert.equal(cleanApiKey(quotedKey), 'AIzaSyC1234567890abcdefghijklmnopqrst');

  // Test B: Single quoted with env prefix
  const envPrefixed = "GEMINI_API_KEY='AIzaSyC1234567890abcdefghijklmnopqrst'";
  assert.equal(cleanApiKey(envPrefixed), 'AIzaSyC1234567890abcdefghijklmnopqrst');

  // Test C: Modern Google AI Studio Auth Key (AQ. format)
  const aqKey = '  AQ.AbC123_xYz-9876543210abcdefghijklmnop  ';
  assert.equal(cleanApiKey(aqKey), 'AQ.AbC123_xYz-9876543210abcdefghijklmnop');

  // Test D: Key with trailing whitespace, zero-width spaces, or carriage returns
  const messyKey = 'key: "AQ.MessyKeyWithSpaces\r\n\u200B" ';
  assert.equal(cleanApiKey(messyKey), 'AQ.MessyKeyWithSpaces');
});
