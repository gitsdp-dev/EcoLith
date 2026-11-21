import { Router } from 'express';
import { z } from 'zod';
import { encryptApiKey, decryptApiKey } from '../lib/crypto.js';
import * as vault from '../lib/vault.js';
import { keyRateLimiter } from '../middleware/rateLimit.js';

export const keysRouter = Router();

const putKeySchema = z.object({
  apiKey: z.string().trim().min(20, 'API key must be at least 20 characters').max(200, 'API key is too long')
});

/**
 * Validates a Gemini API key by making a lightweight models query to Google.
 * Key is passed via x-goog-api-key header (never in URL).
 * @param {string} apiKey
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
async function testGeminiKey(apiKey) {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    if (res.ok) {
      return { valid: true };
    }

    const errData = await res.json().catch(() => ({}));
    const message = errData.error?.message || `Google returned status ${res.status}`;
    return { valid: false, error: message };
  } catch (networkErr) {
    return { valid: false, error: 'Network failure communicating with Google Gemini API.' };
  }
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

    const rawKey = parseResult.data.apiKey;

    // Validate key against Google Gemini
    const testResult = await testGeminiKey(rawKey);
    if (!testResult.valid) {
      return res.status(400).json({
        error: 'InvalidApiKey',
        message: 'Google Gemini rejected this key. Please check your key in Google AI Studio and ensure Generative Language API is enabled.'
      });
    }

    // Encrypt key with AES-256-GCM bound to caller's UUID
    const encrypted = encryptApiKey(rawKey, req.user.id);

    // Save to private vault via database security definer function
    await vault.putKey(req.user.id, encrypted);

    // Return only non-sensitive metadata
    return res.status(200).json({
      hasKey: true,
      last4: encrypted.keyLast4,
      status: 'valid',
      validatedAt: new Date().toISOString()
    });
  } catch (err) {
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
  } catch (err) {
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

    const newStatus = testResult.valid ? 'valid' : 'invalid';
    await vault.setStatus(req.user.id, newStatus, testResult.error || null);

    return res.status(200).json({
      hasKey: true,
      status: newStatus,
      validatedAt: new Date().toISOString(),
      error: testResult.valid ? null : testResult.error
    });
  } catch (err) {
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
  } catch (err) {
    return res.status(500).json({
      error: 'VaultError',
      message: 'Failed to delete key.'
    });
  }
});
