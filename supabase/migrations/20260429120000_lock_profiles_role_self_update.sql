-- Security hardening: prevent customers from self-promoting to admin/superadmin
-- via PATCH /rest/v1/profiles using their own auth token.
--
-- Background:
--   The original profiles_update_own policy allowed any authenticated user to
--   update ANY column on their own row, including `role` and `permissions`.
--   This let any customer escalate themselves to "superadmin" with one curl.
--
-- Fix:
--   1. Replace profiles_update_own with a WITH CHECK clause that forbids
--      changing `role`, `permissions`, `email`, or `id` from the customer client.
--   2. Block direct UPDATEs to those columns at the table level via a trigger
--      so even a future broken policy can't bypass it. Only the service-role
--      key (used by /api/admin/staff) can change role / permissions.

begin;

-- 1. Replace the over-permissive update policy
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role is not distinct from (select p.role from public.profiles p where p.id = auth.uid())
    and (permissions is not distinct from (select p.permissions from public.profiles p where p.id = auth.uid()))
    and email is not distinct from (select p.email from public.profiles p where p.id = auth.uid())
  );

-- 2. Defense in depth: trigger-level block on any non-service-role role/permission change
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow if executed by the service role (server-side admin endpoints)
  if current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' then
    return new;
  end if;

  -- Block if a non-service-role caller is trying to change role or permissions
  if (new.role is distinct from old.role) then
    raise exception 'profiles.role can only be changed by an authorized admin endpoint'
      using errcode = '42501';
  end if;

  if (new.permissions is distinct from old.permissions) then
    raise exception 'profiles.permissions can only be changed by an authorized admin endpoint'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_role_escalation on public.profiles;
create trigger profiles_prevent_self_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_self_role_escalation();

commit;
