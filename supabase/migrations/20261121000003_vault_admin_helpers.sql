-- =============================================================================
-- EcoLith Vault Admin Status Migration
-- Allows service_role to check user key statuses without exposing ciphertexts
-- =============================================================================

create or replace function public.vault_get_all_statuses()
returns table (user_id uuid, status text, key_last4 text, validated_at timestamptz)
language sql security definer set search_path = '' as $$
  select user_id, status, key_last4, validated_at
  from private.user_api_keys;
$$;

-- Revoke all access from public, anon, and authenticated
revoke all on function public.vault_get_all_statuses() from public, anon, authenticated;

-- Grant execution explicitly to service_role only
grant execute on function public.vault_get_all_statuses() to service_role;
