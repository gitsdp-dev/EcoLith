import { Router } from 'express';
import { z } from 'zod';
import * as vault from '../lib/vault.js';
import { decryptApiKey } from '../lib/crypto.js';
import { analyzeFoodImageWithGemini } from '../lib/gemini.js';
import { analyzeRateLimiter } from '../middleware/rateLimit.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export const analyzeRouter = Router();

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
// Base64 encoding expands size by ~4/3
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3);

const analyzeRequestSchema = z.object({
  image: z
    .string({
      required_error: 'Image data is required'
    })
    .min(100, 'Image payload is too small'),
  mimeType: z
    .enum(['image/jpeg', 'image/png', 'image/webp'], {
      errorMap: () => ({
        message: 'Supported image formats are image/jpeg, image/png, and image/webp'
      })
    })
    .default('image/jpeg')
});

/**
 * Logs a non-sensitive usage event for admin analytics.
 * Never logs payloads, images, or key materials.
 */
async function logUsageEvent(userId, eventType, status, latencyMs) {
  try {
    await supabaseAdmin.from('api_usage_events').insert({
      user_id: userId,
      event_type: eventType,
      status,
      latency_ms: latencyMs
    });
  } catch (err) {
    // Fail silent on audit event logging so core analysis isn't interrupted
    console.warn('[UsageLog] Failed to record usage event:', err.message);
  }
}

/**
 * POST /api/analyze
 * Analyzes a food waste image using the authenticated user's own stored Gemini API key (BYOK).
 */
analyzeRouter.post('/', analyzeRateLimiter, async (req, res) => {
  const startTime = Date.now();
  const userId = req.user.id;
  let decryptedKey = null;

  try {
    // 1. Validate payload structure
    const parseResult = analyzeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'INVALID_PAYLOAD',
        error: 'ValidationError',
        message: parseResult.error.errors[0]?.message || 'Invalid image payload format.'
      });
    }

    const { image, mimeType } = parseResult.data;

    // 2. Enforce image size limit
    if (image.length > MAX_BASE64_LENGTH) {
      return res.status(413).json({
        code: 'PAYLOAD_TOO_LARGE',
        error: 'PayloadTooLarge',
        message: 'Image size exceeds maximum allowed limit of 4 MB. Please downscale the image.'
      });
    }

    // 3. Check for maintenance mode
    try {
      const { data: maintenanceSetting } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle();

      if (maintenanceSetting?.value?.enabled) {
        return res.status(503).json({
          code: 'MAINTENANCE_MODE',
          error: 'ServiceUnavailable',
          message:
            maintenanceSetting.value.message ||
            'EcoLith is currently undergoing scheduled maintenance. Please try again soon.'
        });
      }
    } catch {
      // If table check fails, proceed normally
    }

    // 4. Retrieve user's encrypted key from vault
    const keyRecord = await vault.getKey(userId);
    if (!keyRecord) {
      await logUsageEvent(userId, 'analyze', 'no_key', Date.now() - startTime);
      return res.status(409).json({
        code: 'NO_API_KEY',
        error: 'NoApiKey',
        message:
          'No Gemini API key registered for your account. Please set up your key in Key Vault.'
      });
    }

    if (keyRecord.status === 'invalid') {
      await logUsageEvent(userId, 'analyze', 'invalid_key', Date.now() - startTime);
      return res.status(401).json({
        code: 'API_KEY_INVALID',
        error: 'InvalidApiKey',
        message:
          'Your Gemini API key was marked invalid by Google. Please update your key in Key Vault.'
      });
    }

    // 5. Decrypt user's key in memory (bound to userId AAD)
    try {
      decryptedKey = decryptApiKey(
        keyRecord.ciphertext,
        keyRecord.iv,
        keyRecord.auth_tag,
        userId,
        keyRecord.key_version
      );
    } catch {
      await logUsageEvent(userId, 'analyze', 'decrypt_error', Date.now() - startTime);
      return res.status(500).json({
        code: 'VAULT_DECRYPT_ERROR',
        error: 'VaultError',
        message: 'Failed to decrypt credentials from secure vault.'
      });
    }

    // 6. Call Gemini with user's key
    const analysisResult = await analyzeFoodImageWithGemini(decryptedKey, image, mimeType);

    const latency = Date.now() - startTime;
    await logUsageEvent(userId, 'analyze', 'ok', latency);

    return res.status(200).json(analysisResult);
  } catch (err) {
    const latency = Date.now() - startTime;

    // Handle key invalidation from Gemini
    if (err.code === 'API_KEY_INVALID') {
      try {
        await vault.setStatus(userId, 'invalid', 'API_KEY_INVALID');
      } catch (vaultErr) {
        console.warn('[Vault] Failed to update key status:', vaultErr.message);
      }
      await logUsageEvent(userId, 'analyze', 'invalid_key', latency);

      return res.status(401).json({
        code: 'API_KEY_INVALID',
        error: 'InvalidApiKey',
        message:
          'Google Gemini rejected your API key. Please verify or replace it in the Key Vault.'
      });
    }

    // Handle Gemini quota exhaustion
    if (err.code === 'QUOTA_EXCEEDED') {
      try {
        await vault.setStatus(userId, 'rate_limited', 'QUOTA_EXCEEDED');
      } catch (vaultErr) {
        console.warn('[Vault] Failed to update key status:', vaultErr.message);
      }
      await logUsageEvent(userId, 'analyze', 'quota', latency);

      return res.status(429).json({
        code: 'QUOTA_EXCEEDED',
        error: 'QuotaExceeded',
        message:
          'Your Google Gemini API quota has been exceeded. Please check your quota limits in Google AI Studio.'
      });
    }

    // Other upstream Gemini or schema validation errors
    await logUsageEvent(userId, 'analyze', 'error', latency);

    return res.status(err.status || 500).json({
      code: err.code || 'ANALYSIS_ERROR',
      error: 'AnalysisError',
      message: err.message || 'Failed to complete image analysis.'
    });
  } finally {
    // Explicitly nullify decrypted key from memory
    decryptedKey = null;
  }
});
