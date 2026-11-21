-- =============================================================================
-- EcoLith Schema & Security Migration
-- Covers Phase 1 & Phase 1B (BYOK Private Schema & Vault Functions)
-- =============================================================================

-- 1. Create Private Schema for BYOK Vault
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- 2. Default-Deny Security Hardening on Public Schema
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- =============================================================================
-- 3. Core Tables
-- =============================================================================

-- Profiles: Mirrors auth.users, holds no credentials
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- Food Scans: Stored user scan records
create table if not exists public.food_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  food_category text not null,
  waste_category text not null check (waste_category in
    ('edible_reusable', 'surplus_redistributable', 'unavoidable_organic', 'other_separate')),
  quantity numeric not null check (quantity > 0),
  quantity_unit text not null check (quantity_unit in ('g', 'kg', 'piece', 'ml', 'l')),
  ai_confidence numeric check (ai_confidence between 0 and 1),
  user_corrected boolean not null default false,
  created_at timestamptz not null default now()
);

-- Recovery Records: Circular resource recovery actions
create table if not exists public.recovery_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_id uuid not null references public.food_scans(id) on delete cascade,
  recovery_method text not null check (recovery_method in
    ('reuse', 'redistribution', 'composting', 'biogas', 'pectin_recovery', 'material_recovery', 'separate_disposal')),
  recommendation_reason text,
  estimated_resource_value text,
  status text not null default 'suggested' check (status in
    ('suggested', 'planned', 'completed', 'dismissed')),
  created_at timestamptz not null default now()
);

-- User Preferences
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_units text default 'kg',
  preferred_language text default 'en',
  notification_preferences jsonb default '{}'::jsonb
);

-- Admin-managed Recovery Rules
create table if not exists public.recovery_rules (
  id uuid primary key default gen_random_uuid(),
  material_pattern text not null,
  waste_category text not null,
  recovery_method text not null,
  requirements text,
  explanation text,
  is_active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Global App Settings (backend only)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Append-only Audit Logs (backend only)
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- API Usage Events for Admin Monitoring (backend only)
create table if not exists public.api_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  status text not null,
  latency_ms int,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 4. BYOK Encrypted Key Storage (Private Schema)
-- =============================================================================

create table if not exists private.user_api_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'gemini' check (provider = 'gemini'),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version int not null default 1,
  key_last4 text not null,
  status text not null default 'valid' check (status in ('valid', 'invalid', 'rate_limited')),
  validated_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Explicitly force RLS and revoke access from public, anon, authenticated
alter table private.user_api_keys enable row level security;
alter table private.user_api_keys force row level security;
revoke all on private.user_api_keys from public, anon, authenticated;

-- =============================================================================
-- 5. Indexes
-- =============================================================================

create index if not exists idx_food_scans_user_created on public.food_scans (user_id, created_at desc);
create index if not exists idx_recovery_records_user_created on public.recovery_records (user_id, created_at desc);
create index if not exists idx_api_usage_events_created on public.api_usage_events (created_at desc);

-- =============================================================================
-- 6. Grants & Column-Level Security
-- =============================================================================

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

grant select, insert, update, delete on public.food_scans to authenticated;
grant select, insert, update, delete on public.recovery_records to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select on public.recovery_rules to authenticated;

-- =============================================================================
-- 7. Row Level Security Policies
-- =============================================================================

-- Force RLS on all public tables
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

alter table public.food_scans enable row level security;
alter table public.food_scans force row level security;

alter table public.recovery_records enable row level security;
alter table public.recovery_records force row level security;

alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

alter table public.recovery_rules enable row level security;
alter table public.recovery_rules force row level security;

alter table public.app_settings enable row level security;
alter table public.app_settings force row level security;

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

alter table public.api_usage_events enable row level security;
alter table public.api_usage_events force row level security;

-- Profiles Policies
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Food Scans Policies
create policy "food_scans_select_own" on public.food_scans
  for select to authenticated using (auth.uid() = user_id);

create policy "food_scans_insert_own" on public.food_scans
  for insert to authenticated with check (auth.uid() = user_id);

create policy "food_scans_update_own" on public.food_scans
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "food_scans_delete_own" on public.food_scans
  for delete to authenticated using (auth.uid() = user_id);

-- Recovery Records Policies
create policy "recovery_records_select_own" on public.recovery_records
  for select to authenticated using (auth.uid() = user_id);

create policy "recovery_records_insert_own" on public.recovery_records
  for insert to authenticated with check (auth.uid() = user_id);

create policy "recovery_records_update_own" on public.recovery_records
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "recovery_records_delete_own" on public.recovery_records
  for delete to authenticated using (auth.uid() = user_id);

-- User Preferences Policies
create policy "user_preferences_select_own" on public.user_preferences
  for select to authenticated using (auth.uid() = user_id);

create policy "user_preferences_insert_own" on public.user_preferences
  for insert to authenticated with check (auth.uid() = user_id);

create policy "user_preferences_update_own" on public.user_preferences
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Recovery Rules Policy (Read-only active rules for authenticated users)
create policy "recovery_rules_read_active" on public.recovery_rules
  for select to authenticated using (is_active = true);

-- Note: app_settings, audit_logs, api_usage_events intentionally have NO client policies (backend service_role only).

-- =============================================================================
-- 8. Profile Auto-Creation Trigger
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email, avatar_url, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'user',
    'active'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 9. Vault Functions (Server Service-Role Only)
-- =============================================================================

create or replace function public.vault_put_key(
  p_user uuid, p_ct text, p_iv text, p_tag text, p_ver int, p_last4 text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.user_api_keys
    (user_id, ciphertext, iv, auth_tag, key_version, key_last4, status, validated_at, updated_at)
  values (p_user, p_ct, p_iv, p_tag, p_ver, p_last4, 'valid', now(), now())
  on conflict (user_id) do update set
    ciphertext = excluded.ciphertext,
    iv = excluded.iv,
    auth_tag = excluded.auth_tag,
    key_version = excluded.key_version,
    key_last4 = excluded.key_last4,
    status = 'valid',
    validated_at = now(),
    last_error_code = null,
    updated_at = now();
end $$;

create or replace function public.vault_get_key(p_user uuid)
returns table (ciphertext text, iv text, auth_tag text, key_version int, status text)
language sql security definer set search_path = '' as $$
  select ciphertext, iv, auth_tag, key_version, status
  from private.user_api_keys where user_id = p_user;
$$;

create or replace function public.vault_delete_key(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  delete from private.user_api_keys where user_id = p_user;
$$;

create or replace function public.vault_get_status(p_user uuid)
returns table (has_key boolean, key_last4 text, status text, validated_at timestamptz)
language sql security definer set search_path = '' as $$
  select
    case when count(*) > 0 then true else false end as has_key,
    max(key_last4) as key_last4,
    max(status) as status,
    max(validated_at) as validated_at
  from private.user_api_keys
  where user_id = p_user;
$$;

create or replace function public.vault_set_status(p_user uuid, p_status text, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update private.user_api_keys
  set status = p_status,
      last_error_code = p_error,
      updated_at = now()
  where user_id = p_user;
end $$;

-- Revoke all vault function access from public, anon, and authenticated
revoke all on function public.vault_put_key(uuid, text, text, text, int, text) from public, anon, authenticated;
revoke all on function public.vault_get_key(uuid) from public, anon, authenticated;
revoke all on function public.vault_delete_key(uuid) from public, anon, authenticated;
revoke all on function public.vault_get_status(uuid) from public, anon, authenticated;
revoke all on function public.vault_set_status(uuid, text, text) from public, anon, authenticated;

-- Grant execution explicitly to service_role only
grant execute on function public.vault_put_key(uuid, text, text, text, int, text) to service_role;
grant execute on function public.vault_get_key(uuid) to service_role;
grant execute on function public.vault_delete_key(uuid) to service_role;
grant execute on function public.vault_get_status(uuid) to service_role;
grant execute on function public.vault_set_status(uuid, text, text) to service_role;
