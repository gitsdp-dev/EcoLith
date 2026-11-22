-- =============================================================================
-- EcoLith Migration: Admin Live Data & Reports Functions
-- Strictly enables live data reporting and user visibility for administrators
-- =============================================================================

-- 1. Helper function to check if caller is the platform administrator
create or replace function public.is_admin_caller()
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  ) or exists (
    select 1 from auth.users
    where id = auth.uid() and email in ('githubsdp2011@gmail.com', 'EducationPatra2011@outlook.com')
  ) or (
    coalesce(auth.jwt()->>'email', '') in ('githubsdp2011@gmail.com', 'EducationPatra2011@outlook.com')
  );
$$;

grant execute on function public.is_admin_caller to authenticated;

-- 2. Allow users to update their own last_seen_at timestamp
grant update (display_name, avatar_url, last_seen_at) on public.profiles to authenticated;

-- 3. Profiles Selection Policy:
-- Regular users see their own profile; Administrator sees ALL profiles
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_admin_read_all" on public.profiles;
drop policy if exists "profiles_select_policy" on public.profiles;

create policy "profiles_select_policy" on public.profiles
  for select to authenticated using (
    auth.uid() = id
    or public.is_admin_caller()
  );

-- 4. Food Scans Selection Policy:
-- Regular users see their own scans; Administrator sees ALL scans
drop policy if exists "food_scans_select_own" on public.food_scans;
drop policy if exists "food_scans_admin_read_all" on public.food_scans;
drop policy if exists "food_scans_select_policy" on public.food_scans;

create policy "food_scans_select_policy" on public.food_scans
  for select to authenticated using (
    auth.uid() = user_id
    or public.is_admin_caller()
  );

-- 5. Recovery Records Selection Policy:
-- Regular users see their own recovery records; Administrator sees ALL records
drop policy if exists "recovery_records_select_own" on public.recovery_records;
drop policy if exists "recovery_records_admin_read_all" on public.recovery_records;
drop policy if exists "recovery_records_select_policy" on public.recovery_records;

create policy "recovery_records_select_policy" on public.recovery_records
  for select to authenticated using (
    auth.uid() = user_id
    or public.is_admin_caller()
  );

-- 6. Audit Logs: Allow administrator to read audit records
drop policy if exists "audit_logs_admin_read_all" on public.audit_logs;
create policy "audit_logs_admin_read_all" on public.audit_logs
  for select to authenticated using (
    public.is_admin_caller()
  );
grant select on public.audit_logs to authenticated;

-- 7. Live Overview Analytics Security Definer RPC
create or replace function public.admin_get_overview()
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_total_users int := 0;
  v_active_users int := 0;
  v_total_scans int := 0;
  v_total_recoveries int := 0;
  v_completed_recoveries int := 0;
  v_byok_count int := 0;
  v_total_waste_kg numeric := 0;
  v_category_dist json;
  v_method_dist json;
begin
  if not public.is_admin_caller() then
    raise exception 'Access Denied: Administrator privileges required';
  end if;

  select count(*) into v_total_users from public.profiles;
  select count(*) into v_active_users from public.profiles where status = 'active';
  select count(*) into v_total_scans from public.food_scans;
  select count(*) into v_total_recoveries from public.recovery_records;
  select count(*) into v_completed_recoveries from public.recovery_records where status = 'completed';

  begin
    select count(*) into v_byok_count from private.user_api_keys where status = 'valid';
  exception when others then
    v_byok_count := 0;
  end;

  select coalesce(sum(
    case 
      when quantity_unit = 'g' then quantity / 1000.0
      when quantity_unit = 'piece' then quantity * 0.15
      when quantity_unit = 'ml' then quantity / 1000.0
      else quantity
    end
  ), 0) into v_total_waste_kg from public.food_scans;

  select json_build_object(
    'edible_reusable', count(*) filter (where waste_category = 'edible_reusable'),
    'surplus_redistributable', count(*) filter (where waste_category = 'surplus_redistributable'),
    'unavoidable_organic', count(*) filter (where waste_category = 'unavoidable_organic'),
    'other_separate', count(*) filter (where waste_category = 'other_separate')
  ) into v_category_dist from public.food_scans;

  select json_object_agg(coalesce(recovery_method, 'other'), m_count)
  into v_method_dist
  from (
    select recovery_method, count(*) as m_count
    from public.recovery_records
    group by recovery_method
  ) sub;

  return json_build_object(
    'metrics', json_build_object(
      'totalUsers', greatest(1, coalesce(v_total_users, 1)),
      'activeUsers', greatest(1, coalesce(v_active_users, 1)),
      'suspendedUsers', greatest(0, coalesce(v_total_users, 0) - coalesce(v_active_users, 0)),
      'totalScans', coalesce(v_total_scans, 0),
      'totalRecoveries', coalesce(v_total_recoveries, 0),
      'completedRecoveries', coalesce(v_completed_recoveries, 0),
      'byokAdoptionRate', case when coalesce(v_total_users, 0) > 0 then round((coalesce(v_byok_count, 0)::numeric / v_total_users) * 100) else 0 end,
      'totalWasteKg', round(coalesce(v_total_waste_kg, 0), 1)
    ),
    'wasteCategoryDistribution', coalesce(v_category_dist, '{}'::json),
    'recoveryMethodDistribution', coalesce(v_method_dist, '{}'::json)
  );
end;
$$;

grant execute on function public.admin_get_overview to authenticated;

-- 8. Live User List Security Definer RPC
create or replace function public.admin_get_users(p_search text default '', p_status text default '')
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_users json;
begin
  if not public.is_admin_caller() then
    raise exception 'Access Denied: Administrator privileges required';
  end if;

  select json_agg(u_row) into v_users
  from (
    select 
      p.id,
      p.email,
      coalesce(p.display_name, split_part(p.email, '@', 1), 'User') as display_name,
      p.avatar_url,
      case 
        when p.email in ('githubsdp2011@gmail.com', 'EducationPatra2011@outlook.com') then 'admin'
        else 'user'
      end as role,
      p.status,
      coalesce((select count(*) from public.food_scans fs where fs.user_id = p.id), 0) as scan_count,
      coalesce((select k.status from private.user_api_keys k where k.user_id = p.id), 'none') as key_status,
      p.last_seen_at,
      p.created_at
    from public.profiles p
    where (p_search is null or p_search = '' or p.email ilike '%' || p_search || '%' or p.display_name ilike '%' || p_search || '%')
      and (p_status is null or p_status = '' or p_status = 'all' or p.status = p_status)
    order by (case when p.email in ('githubsdp2011@gmail.com', 'EducationPatra2011@outlook.com') then 0 else 1 end), p.created_at desc
  ) u_row;

  return coalesce(v_users, '[]'::json);
end;
$$;

grant execute on function public.admin_get_users to authenticated;
