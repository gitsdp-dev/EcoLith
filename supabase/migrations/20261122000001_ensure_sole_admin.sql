-- =============================================================================
-- EcoLith Migration: Enforce Single Administrator Role
-- Strictly enforces: "Only me (1 admin) should be there"
-- =============================================================================

create or replace function public.ensure_sole_admin_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email in ('githubsdp2011@gmail.com', 'EducationPatra2011@outlook.com') then
    new.role := 'admin';
  else
    -- Demote any non-owner attempting to take or hold admin role
    if new.role = 'admin' then
      new.role := 'user';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_sole_admin_role on public.profiles;
create trigger trg_ensure_sole_admin_role
  before insert or update on public.profiles
  for each row execute procedure public.ensure_sole_admin_role();

-- Auto-promote designated administrator profile if already registered
update public.profiles
set role = 'admin'
where email in ('githubsdp2011@gmail.com', 'EducationPatra2011@outlook.com');

-- Ensure no other profile holds the administrator role
update public.profiles
set role = 'user'
where email not in ('githubsdp2011@gmail.com', 'EducationPatra2011@outlook.com')
  and role = 'admin';
