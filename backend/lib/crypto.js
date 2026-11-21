import crypto from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config();

const CURRENT_KEY_VERSION = 1;

/**
 * Derives a 32-byte master encryption key from environment variable.
 * @returns {Buffer}
 */
function getMasterSecret() {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('KEY_ENCRYPTION_SECRET is not configured on the backend.');
  }

  // If secret is base64 encoded and 32 bytes
  const buf = Buffer.from(secret, 'base64');
  if (buf.length === 32) {
    return buf;
  }

  // Fallback: SHA-256 hash to ensure exact 32-byte length
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a user's API key with AES-256-GCM.
 * Uses the user's ID as Additional Authenticated Data (AAD) to prevent ciphertext swapping.
 *
 * @param {string} apiKey - Raw API key
 * @param {string} userId - UUID of the user owning the key
 * @returns {{ ciphertext: string, iv: string, authTag: string, keyVersion: number, keyLast4: string }}
 */
export function encryptApiKey(apiKey, userId) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key input for encryption.');
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID provided for key authentication binding.');
  }

  const masterSecret = getMasterSecret();
  // Generate random 12-byte IV
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', masterSecret, iv);

  // Bind ciphertext cryptographically to the user ID (AAD)
  cipher.setAAD(Buffer.from(userId, 'utf-8'));

  let ciphertext = cipher.update(apiKey, 'utf-8', 'base64');
  ciphertext += cipher.final('base64');

  const authTag = cipher.getAuthTag().toString('base64');
  const keyLast4 = apiKey.slice(-4);

  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag,
    keyVersion: CURRENT_KEY_VERSION,
    keyLast4
  };
}

/**
 * Decrypts a user's API key in memory.
 * Validates GCM auth tag and user ID AAD.
 *
 * @param {string} ciphertext - Base64 ciphertext
 * @param {string} ivBase64 - Base64 12-byte IV
 * @param {string} authTagBase64 - Base64 auth tag
 * @param {string} userId - UUID of the requesting user
 * @param {number} keyVersion - Version of the key
 * @returns {string} Plaintext API key (decrypted in memory only)
 */
export function decryptApiKey(ciphertext, ivBase64, authTagBase64, userId, keyVersion = CURRENT_KEY_VERSION) {
  const masterSecret = getMasterSecret();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', masterSecret, iv);

  // Verify AAD matches the requesting user ID
  decipher.setAAD(Buffer.from(userId, 'utf-8'));
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');

  return decrypted;
}
