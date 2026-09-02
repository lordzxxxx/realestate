-- Phase 1: Row Level Security
-- Server/database authorization backing every table touched so far (section 59/60).
-- Principle: RLS is the last line of defense, enforced even if application code
-- has a bug or a caller hits PostgREST directly.

-- Ignore org scoping entirely; true if the user holds this permission via ANY
-- role (global or scoped to any organization). Used for gates on platform-wide
-- reference data (roles/permissions) where "which org" is not a meaningful axis.
create or replace function has_permission_any(
  p_user_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions p on p.id = rp.permission_id
    where ur.user_id = p_user_id
      and p.key = p_permission
  );
$$;

-- Returns the calling user's own permission keys, scoped per organization.
-- Safe to expose broadly: it only ever reveals the caller's own grants.
create or replace function my_permissions()
returns table (permission_key text, organization_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.key, ur.organization_id
  from user_roles ur
  join role_permissions rp on rp.role_id = ur.role_id
  join permissions p on p.id = rp.permission_id
  where ur.user_id = auth.uid();
$$;

create or replace function my_profile()
returns profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from profiles where id = auth.uid();
$$;

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table user_roles enable row level security;
alter table system_settings enable row level security;
alter table organization_settings enable row level security;

-- ORGANIZATIONS ---------------------------------------------------------

create policy organizations_select on organizations
  for select
  to authenticated
  using (
    id in (select user_organization_ids(auth.uid()))
    or current_user_has_permission('organization.view', id)
  );

create policy organizations_insert on organizations
  for insert
  to authenticated
  with check (current_user_has_permission('organization.create'));

create policy organizations_update on organizations
  for update
  to authenticated
  using (current_user_has_permission('organization.edit', id))
  with check (current_user_has_permission('organization.edit', id));

-- PROFILES ----------------------------------------------------------------
-- No insert policy: rows are created exclusively by handle_new_auth_user()
-- (SECURITY DEFINER, bypasses RLS) off the Supabase Auth signup flow.

create policy profiles_select on profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or current_user_has_permission('user.view', organization_id)
  );

create policy profiles_update on profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    or current_user_has_permission('user.edit', organization_id)
  )
  with check (
    id = auth.uid()
    or current_user_has_permission('user.edit', organization_id)
  );

-- Status transitions (approve/suspend/reactivate/archive) are privileged and
-- go through this RPC rather than a raw UPDATE so each transition is checked
-- against its own specific permission instead of the broad user.edit.
create or replace function set_profile_status(
  p_profile_id uuid,
  p_new_status profile_status
)
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target profiles;
  v_required_permission text;
  v_result profiles;
begin
  select * into v_target from profiles where id = p_profile_id;
  if not found then
    raise exception 'profile % not found', p_profile_id using errcode = 'P0002';
  end if;

  v_required_permission := case p_new_status
    when 'ACTIVE' then case when v_target.status = 'PENDING' then 'user.approve' else 'user.reactivate' end
    when 'SUSPENDED' then 'user.suspend'
    when 'ARCHIVED' then 'user.archive'
    else null
  end;

  if v_required_permission is null then
    raise exception 'unsupported status transition to %', p_new_status using errcode = '22023';
  end if;

  if not has_permission(auth.uid(), v_required_permission, v_target.organization_id) then
    raise exception 'permission % required' , v_required_permission using errcode = '42501';
  end if;

  update profiles
  set status = p_new_status,
      approved_at = case when p_new_status = 'ACTIVE' and status = 'PENDING' then now() else approved_at end,
      approved_by = case when p_new_status = 'ACTIVE' and status = 'PENDING' then auth.uid() else approved_by end,
      suspended_at = case when p_new_status = 'SUSPENDED' then now() else suspended_at end,
      archived_at = case when p_new_status = 'ARCHIVED' then now() else archived_at end
  where id = p_profile_id
  returning * into v_result;

  return v_result;
end;
$$;

-- ROLES / PERMISSIONS / ROLE_PERMISSIONS (platform-wide reference data) ---

create policy roles_select on roles
  for select
  to authenticated
  using (has_permission_any(auth.uid(), 'rbac.view'));

create policy roles_manage on roles
  for all
  to authenticated
  using (has_permission_any(auth.uid(), 'rbac.manage'))
  with check (has_permission_any(auth.uid(), 'rbac.manage'));

create policy permissions_select on permissions
  for select
  to authenticated
  using (has_permission_any(auth.uid(), 'rbac.view'));

create policy role_permissions_select on role_permissions
  for select
  to authenticated
  using (has_permission_any(auth.uid(), 'rbac.view'));

create policy role_permissions_manage on role_permissions
  for all
  to authenticated
  using (has_permission_any(auth.uid(), 'rbac.manage'))
  with check (has_permission_any(auth.uid(), 'rbac.manage'));

-- USER_ROLES ----------------------------------------------------------------

create policy user_roles_select on user_roles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'rbac.view', organization_id)
    or has_permission(auth.uid(), 'user.view', organization_id)
  );

create policy user_roles_manage on user_roles
  for all
  to authenticated
  using (has_permission(auth.uid(), 'rbac.manage', organization_id))
  with check (has_permission(auth.uid(), 'rbac.manage', organization_id));

-- SETTINGS --------------------------------------------------------------

create policy system_settings_select on system_settings
  for select
  to authenticated
  using (has_permission_any(auth.uid(), 'rbac.manage'));

create policy system_settings_manage on system_settings
  for all
  to authenticated
  using (has_permission_any(auth.uid(), 'rbac.manage'))
  with check (has_permission_any(auth.uid(), 'rbac.manage'));

create policy organization_settings_select on organization_settings
  for select
  to authenticated
  using (current_user_has_permission('organization.view', organization_id));

create policy organization_settings_manage on organization_settings
  for all
  to authenticated
  using (current_user_has_permission('organization.edit', organization_id))
  with check (current_user_has_permission('organization.edit', organization_id));
