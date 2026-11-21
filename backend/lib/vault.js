import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Vault Data Access Layer.
 * Only this module is authorized to invoke private.user_api_keys via vault_* functions.
 */

/**
 * Checks whether an API key hash is already registered to another user (anti-convergence check).
 * Enforces "One Key, One User".
 * @param {string} userId
 * @param {string} keyHash
 * @returns {Promise<boolean>} True if another user already has this key
 */
export async function isKeyClaimedByOther(userId, keyHash) {
  try {
    const { data, error } = await supabaseAdmin.rpc('vault_check_key_hash_exists', {
      p_hash: keyHash,
      p_user: userId
    });

    if (error) {
      // If RPC is not created yet, fallback check via table query
      const { data: existing } = await supabaseAdmin
        .from('user_api_keys')
        .select('user_id')
        .eq('key_hash', keyHash)
        .neq('user_id', userId)
        .limit(1);

      return Boolean(existing && existing.length > 0);
    }

    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * Stores or updates an encrypted key in the vault.
 * @param {string} userId
 * @param {{ ciphertext: string, iv: string, authTag: string, keyVersion: number, keyLast4: string }} encrypted
 * @param {string} [keyHash] - HMAC-SHA256 fingerprint for one-key-one-user uniqueness
 */
export async function putKey(userId, encrypted, keyHash = null) {
  const rpcParams = {
    p_user: userId,
    p_ct: encrypted.ciphertext,
    p_iv: encrypted.iv,
    p_tag: encrypted.authTag,
    p_ver: encrypted.keyVersion,
    p_last4: encrypted.keyLast4
  };

  if (keyHash) {
    rpcParams.p_hash = keyHash;
  }

  const { error } = await supabaseAdmin.rpc('vault_put_key', rpcParams);

  if (error) {
    if (error.message && error.message.includes('KEY_ALREADY_REGISTERED')) {
      const err = new Error('This API key is already registered to another account.');
      err.code = 'KeyAlreadyClaimed';
      throw err;
    }
    // Fallback if rpc without p_hash is used in older schema
    if (error.message && error.message.includes('p_hash')) {
      delete rpcParams.p_hash;
      const { error: retryErr } = await supabaseAdmin.rpc('vault_put_key', rpcParams);
      if (retryErr) throw new Error(`Failed to store key in vault: ${retryErr.message}`);
      return;
    }
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
