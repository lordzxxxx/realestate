-- Phase 1: RBAC
-- Real server/database authorization (section 8), independent of user_category.
-- A profile can hold multiple roles, each either global (organization_id null,
-- reserved for platform-wide roles like SUPER_ADMIN) or scoped to one organization.

create table roles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  description  text,
  is_system    boolean not null default false, -- system roles cannot be deleted from the UI
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger roles_set_updated_at
  before update on roles
  for each row
  execute function set_updated_at();

create table permissions (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique, -- e.g. 'listing.create'
  category     text not null,        -- e.g. 'LISTINGS'
  description  text
);

create table role_permissions (
  role_id        uuid not null references roles (id) on delete cascade,
  permission_id  uuid not null references permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_roles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles (id) on delete cascade,
  role_id           uuid not null references roles (id) on delete cascade,
  -- null organization_id = role applies platform-wide (e.g. SUPER_ADMIN)
  organization_id   uuid references organizations (id) on delete cascade,
  created_at        timestamptz not null default now(),
  created_by        uuid references profiles (id),
  unique (user_id, role_id, organization_id)
);

create index user_roles_user_id_idx on user_roles (user_id);
create index user_roles_organization_id_idx on user_roles (organization_id);
create index role_permissions_permission_id_idx on role_permissions (permission_id);

-- Core authorization primitive used by both RLS policies and application code.
-- A permission granted via a global user_role (organization_id is null) applies
-- everywhere; a permission granted via an org-scoped user_role only applies when
-- p_organization_id matches (or is not being checked, i.e. null, in which case
-- only global grants count).
-- SECURITY DEFINER: this must be able to read user_roles/role_permissions/permissions
-- regardless of the caller's own RLS visibility into those tables, since RLS
-- policies elsewhere call this function to decide what the caller may see.
create or replace function has_permission(
  p_user_id uuid,
  p_permission text,
  p_organization_id uuid default null
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
      and (ur.organization_id is null or ur.organization_id = p_organization_id)
  );
$$;

create or replace function current_user_has_permission(
  p_permission text,
  p_organization_id uuid default null
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(has_permission(auth.uid(), p_permission, p_organization_id), false);
$$;

-- All organizations a user has ANY permission grant in (global roles included,
-- represented by returning every organization id).
create or replace function user_organization_ids(p_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from organizations
  where exists (
    select 1 from user_roles ur where ur.user_id = p_user_id and ur.organization_id is null
  )
  union
  select ur.organization_id from user_roles ur
  where ur.user_id = p_user_id and ur.organization_id is not null;
$$;
