import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Vault Data Access Layer.
 * Only this module is authorized to invoke private.user_api_keys via vault_* functions.
 */

/**
 * Stores or updates an encrypted key in the vault.
 * @param {string} userId
 * @param {{ ciphertext: string, iv: string, authTag: string, keyVersion: number, keyLast4: string }} encrypted
 */
export async function putKey(userId, encrypted) {
  const { error } = await supabaseAdmin.rpc('vault_put_key', {
    p_user: userId,
    p_ct: encrypted.ciphertext,
    p_iv: encrypted.iv,
    p_tag: encrypted.authTag,
    p_ver: encrypted.keyVersion,
    p_last4: encrypted.keyLast4
  });

  if (error) {
    throw new Error(`Failed to store key in vault: ${error.message}`);
  }
}

/**
 * Retrieves the encrypted key record for a user.
 * @param {string} userId
 * @returns {Promise<{ ciphertext: string, iv: string, auth_tag: string, key_version: number, status: string } | null>}
 */
export async function getKey(userId) {
  const { data, error } = await supabaseAdmin.rpc('vault_get_key', {
    p_user: userId
  });

  if (error) {
    throw new Error(`Failed to retrieve key from vault: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0];
}

/**
 * Retrieves non-sensitive key status for a user.
 * Never returns ciphertext or key materials.
 * @param {string} userId
 * @returns {Promise<{ hasKey: boolean, last4: string | null, status: string | null, validatedAt: string | null }>}
 */
export async function getStatus(userId) {
  const { data, error } = await supabaseAdmin.rpc('vault_get_status', {
    p_user: userId
  });

  if (error) {
    throw new Error(`Failed to retrieve key status from vault: ${error.message}`);
  }

  if (!data || data.length === 0 || !data[0].has_key) {
    return {
      hasKey: false,
      last4: null,
      status: null,
      validatedAt: null
    };
  }

  const row = data[0];
  return {
    hasKey: true,
    last4: row.key_last4,
    status: row.status,
    validatedAt: row.validated_at
  };
}

/**
 * Updates the validation status of a stored key.
 * @param {string} userId
 * @param {'valid' | 'invalid' | 'rate_limited'} status
 * @param {string|null} errorCode
 */
export async function setStatus(userId, status, errorCode = null) {
  const { error } = await supabaseAdmin.rpc('vault_set_status', {
    p_user: userId,
    p_status: status,
    p_error: errorCode
  });

  if (error) {
    throw new Error(`Failed to update key status in vault: ${error.message}`);
  }
}

/**
 * Permanently removes a user's API key from the vault.
 * @param {string} userId
 */
export async function deleteKey(userId) {
  const { error } = await supabaseAdmin.rpc('vault_delete_key', {
    p_user: userId
  });

  if (error) {
    throw new Error(`Failed to delete key from vault: ${error.message}`);
  }
}
