-- =============================================================================
-- EcoLith Migration: One Key One User Cryptographic Uniqueness
-- Enforces that no key can converge (shared across users) or diverge.
-- =============================================================================

-- 1. Add key_hash column to private.user_api_keys if not exists
alter table private.user_api_keys 
  add column if not exists key_hash text;

-- 2. Create unique index to guarantee no two users can register the same key hash
create unique index if not exists idx_user_api_keys_key_hash 
  on private.user_api_keys (key_hash) 
  where key_hash is not null;

-- 3. Update vault_put_key to accept key_hash and enforce single-user ownership
create or replace function public.vault_put_key(
  p_user uuid,
  p_ct text,
  p_iv text,
  p_tag text,
  p_ver int,
  p_last4 text,
  p_hash text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_existing_user uuid;
begin
  -- Check if another user already owns this key hash (prevent convergence)
  if p_hash is not null then
    select user_id into v_existing_user 
    from private.user_api_keys 
    where key_hash = p_hash and user_id <> p_user
    limit 1;

    if v_existing_user is not null then
      raise exception 'KEY_ALREADY_REGISTERED: This API key is already associated with another account.';
    end if;
  end if;

  -- Insert or update (user_id is PK, preventing divergence)
  insert into private.user_api_keys
    (user_id, ciphertext, iv, auth_tag, key_version, key_last4, key_hash, status, validated_at, updated_at)
  values 
    (p_user, p_ct, p_iv, p_tag, p_ver, p_last4, p_hash, 'valid', now(), now())
  on conflict (user_id) do update set
    ciphertext = excluded.ciphertext,
    iv = excluded.iv,
    auth_tag = excluded.auth_tag,
    key_version = excluded.key_version,
    key_last4 = excluded.key_last4,
    key_hash = excluded.key_hash,
    status = 'valid',
    validated_at = now(),
    last_error_code = null,
    updated_at = now();
end $$;

-- 4. Check function for key uniqueness before writing
create or replace function public.vault_check_key_hash_exists(
  p_hash text,
  p_user uuid
)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 
    from private.user_api_keys 
    where key_hash = p_hash and user_id <> p_user
  );
$$;

-- 5. Revoke permissions from public/anon/authenticated and grant to service_role only
revoke all on function public.vault_put_key(uuid, text, text, text, int, text, text) from public, anon, authenticated;
grant execute on function public.vault_put_key(uuid, text, text, text, int, text, text) to service_role;

revoke all on function public.vault_check_key_hash_exists(text, uuid) from public, anon, authenticated;
grant execute on function public.vault_check_key_hash_exists(text, uuid) to service_role;
