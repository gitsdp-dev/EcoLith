import { Router } from 'express';
import { z } from 'zod';
import { encryptApiKey, decryptApiKey, hashApiKey } from '../lib/crypto.js';
import * as vault from '../lib/vault.js';
import { keyRateLimiter } from '../middleware/rateLimit.js';

export const keysRouter = Router();

const putKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(15, 'API key must be at least 15 characters')
    .max(250, 'API key is too long')
});

/**
 * Sanitizes and cleans an API key string:
 * - Trims whitespace
 * - Strips enclosing quotes (double, single, backtick)
 * - Strips accidental variable assignment prefixes (GEMINI_API_KEY=..., API_KEY=...)
 * - Removes zero-width spaces, BOM, non-breaking spaces, and internal whitespace/newlines
 * @param {string} input
 * @returns {string}
 */
export function cleanApiKey(input) {
  if (!input || typeof input !== 'string') return '';
  let key = input.trim();
  // Strip enclosing quotes: "...", '...', `...`
  key = key.replace(/^["'`]+|["'`]+$/g, '').trim();
  // Strip common environment variable prefixes if copied together
  key = key
    .replace(/^(?:GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_GENAI_API_KEY|API_KEY|key)\s*[:=]\s*/i, '')
    .trim();
  // Strip quotes again in case it was GEMINI_API_KEY="AIza..."
  key = key.replace(/^["'`]+|["'`]+$/g, '').trim();
  // Remove zero-width spaces, byte order marks, non-breaking spaces, and any other internal whitespace/newlines
  key = key.replace(/[\u200B-\u200D\uFEFF\u00A0\s]/g, '').trim();
  return key;
}

/**
 * Validates a Gemini API key with Google using multiple resilient strategies:
 * 1. GET /v1beta/models?pageSize=1 with x-goog-api-key header
 * 2. GET /v1beta/models?pageSize=1&key=... query param fallback
 * 3. Token-count check on gemini-2.5-flash / gemini-2.0-flash / gemini-1.5-flash (essential for restricted keys/service account auth keys)
 * 4. Recognizes 429 / RESOURCE_EXHAUSTED as a valid authentic key (quota reached)
 *
 * @param {string} apiKey
 * @returns {Promise<{ valid: boolean, status?: string, error?: string }>}
 */
export async function testGeminiKey(apiKey) {
  const cleaned = cleanApiKey(apiKey);
  if (!cleaned || cleaned.length < 15) {
    return { valid: false, error: 'API key is too short or invalid format.' };
  }

  const candidateModels = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];
  let lastError = null;

  // Strategy 1: Lightweight models query via x-goog-api-key header (pageSize=1 limits overhead)
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
      method: 'GET',
      headers: {
        'x-goog-api-key': cleaned
      }
    });

    if (res.ok) {
      return { valid: true };
    }

    if (res.status === 429) {
      // Key is recognized and valid, but currently rate-limited/quota exhausted
      return { valid: true, status: 'rate_limited' };
    }

    const errData = await res.json().catch(() => ({}));
    lastError = errData.error?.message || `Google returned status ${res.status}`;

    // If Google explicitly rejected the key as invalid argument
    if (res.status === 400 && lastError.toLowerCase().includes('api key')) {
      return { valid: false, error: lastError };
    }
  } catch (err) {
    lastError = `Network connection failure: ${err.message}`;
  }

  // Strategy 2: Query param fallback (?key=...)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(cleaned)}`,
      {
        method: 'GET'
      }
    );

    if (res.ok) {
      return { valid: true };
    }

    if (res.status === 429) {
      return { valid: true, status: 'rate_limited' };
    }

    const errData = await res.json().catch(() => ({}));
    const message = errData.error?.message;
    if (message) lastError = message;
    if (res.status === 400 && message?.toLowerCase().includes('api key')) {
      return { valid: false, error: message };
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 3: Lightweight countTokens test on candidate models
  // Some restricted keys or service-account AQ. keys cannot list all models but CAN use specific models
  for (const model of candidateModels) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:countTokens`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleaned
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ping' }] }]
          })
        }
      );

      if (res.ok) {
        return { valid: true };
      }

      if (res.status === 429) {
        return { valid: true, status: 'rate_limited' };
      }

      const errData = await res.json().catch(() => ({}));
      const message = errData.error?.message || `Google returned status ${res.status}`;

      if (res.status === 400 && message.toLowerCase().includes('api key')) {
        return { valid: false, error: message };
      }

      // If model not found (404), continue to next candidate model
      if (res.status === 404) {
        continue;
      }

      lastError = message;
    } catch (err) {
      lastError = err.message;
    }
  }

  return {
    valid: false,
    error: lastError || 'Google Gemini rejected this key. Please verify in Google AI Studio.'
  };
}

/**
 * PUT /api/keys
 * Submit and validate a new or replacement Gemini API key.
 */
keysRouter.put('/', keyRateLimiter, async (req, res) => {
  try {
    const parseResult = putKeySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'ValidationError',
        message: parseResult.error.errors[0]?.message || 'Invalid API key format.'
      });
    }

    const rawKey = cleanApiKey(parseResult.data.apiKey);
    if (!rawKey || rawKey.length < 15) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'API key is too short or invalid after formatting.'
      });
    }

    // Cryptographic anti-convergence check: One Key, One User
    const keyHash = hashApiKey(rawKey);
    const isClaimed = await vault.isKeyClaimedByOther(req.user.id, keyHash);
    if (isClaimed) {
      return res.status(409).json({
        error: 'KeyAlreadyClaimed',
        message:
          'This Gemini API key is already associated with another EcoLith account. Each user must provide their own unique key (one key, one user).'
      });
    }

    // Validate key against Google Gemini
    const testResult = await testGeminiKey(rawKey);
    if (!testResult.valid) {
      return res.status(400).json({
        error: 'InvalidApiKey',
        message: testResult.error
          ? `Google Gemini rejected this key: ${testResult.error}`
          : 'Google Gemini rejected this key. Please check your key in Google AI Studio and ensure Generative Language API is enabled.'
      });
    }

    const keyStatus = testResult.status === 'rate_limited' ? 'rate_limited' : 'valid';

    // Encrypt key with AES-256-GCM bound to caller's UUID
    const encrypted = encryptApiKey(rawKey, req.user.id);

    // Save to private vault via database security definer function (with keyHash)
    await vault.putKey(req.user.id, encrypted, keyHash);

    // If rate limited, update status in vault
    if (keyStatus === 'rate_limited') {
      try {
        await vault.setStatus(req.user.id, 'rate_limited', 'QUOTA_EXCEEDED');
      } catch {
        // Non-fatal
      }
    }

    // Return only non-sensitive metadata
    return res.status(200).json({
      hasKey: true,
      last4: encrypted.keyLast4,
      status: keyStatus,
      validatedAt: new Date().toISOString()
    });
  } catch (err) {
    if (
      err.code === 'KeyAlreadyClaimed' ||
      (err.message && err.message.includes('KEY_ALREADY_REGISTERED'))
    ) {
      return res.status(409).json({
        error: 'KeyAlreadyClaimed',
        message:
          'This Gemini API key is already associated with another EcoLith account. Each user must provide their own unique key (one key, one user).'
      });
    }
    console.error('[VaultError] Failed to store API key:', err.message);
    return res.status(500).json({
      error: 'VaultError',
      message: 'Failed to securely store API key.'
    });
  }
});

/**
 * GET /api/keys/status
 * Retrieve key metadata (status, masked last 4, validation time).
 * Never returns ciphertext or key materials.
 */
keysRouter.get('/status', async (req, res) => {
  try {
    const status = await vault.getStatus(req.user.id);
    return res.status(200).json(status);
  } catch {
    return res.status(500).json({
      error: 'VaultError',
      message: 'Failed to retrieve key status.'
    });
  }
});

/**
 * POST /api/keys/revalidate
 * Test the stored key against Gemini and update validation status.
 */
keysRouter.post('/revalidate', keyRateLimiter, async (req, res) => {
  try {
    const record = await vault.getKey(req.user.id);
    if (!record) {
      return res.status(404).json({
        hasKey: false,
        error: 'NotFound',
        message: 'No API key registered for this account.'
      });
    }

    // Decrypt key in memory for validation only
    let decryptedKey;
    try {
      decryptedKey = decryptApiKey(
        record.ciphertext,
        record.iv,
        record.auth_tag,
        req.user.id,
        record.key_version
      );
    } catch {
      await vault.setStatus(req.user.id, 'invalid', 'DECRYPTION_FAILED');
      return res.status(500).json({
        error: 'DecryptionError',
        message: 'Failed to decrypt stored key. Please re-enter your key in the Key Vault.'
      });
    }

    const testResult = await testGeminiKey(decryptedKey);
    // Explicitly discard decrypted string from local reference
    decryptedKey = null;

    const newStatus = testResult.valid
      ? testResult.status === 'rate_limited'
        ? 'rate_limited'
        : 'valid'
      : 'invalid';
    await vault.setStatus(req.user.id, newStatus, testResult.error || null);

    return res.status(200).json({
      hasKey: true,
      status: newStatus,
      validatedAt: new Date().toISOString(),
      error: testResult.valid ? null : testResult.error
    });
  } catch {
    return res.status(500).json({
      error: 'VaultError',
      message: 'Failed to revalidate API key.'
    });
  }
});

/**
 * DELETE /api/keys
 * Permanently deletes the user's stored API key from the vault.
 */
keysRouter.delete('/', async (req, res) => {
  try {
    await vault.deleteKey(req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Your Gemini API key has been permanently deleted from the vault.'
    });
  } catch {
    return res.status(500).json({
      error: 'VaultError',
      message: 'Failed to delete key.'
    });
  }
});
