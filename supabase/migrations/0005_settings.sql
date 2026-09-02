-- Phase 1: System & organization settings (section 58, 79)

create table system_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles (id)
);

create trigger system_settings_set_updated_at
  before update on system_settings
  for each row
  execute function set_updated_at();

create table organization_settings (
  organization_id                uuid primary key references organizations (id) on delete cascade,
  auto_approve_registrations     boolean not null default false,
  listing_approval_required      boolean not null default true,
  auto_publish_website           boolean not null default true,
  auto_publish_facebook          boolean not null default true,
  auto_sync_google_sheets        boolean not null default true,
  settings                       jsonb not null default '{}'::jsonb,
  updated_at                     timestamptz not null default now(),
  updated_by                     uuid references profiles (id)
);

create trigger organization_settings_set_updated_at
  before update on organization_settings
  for each row
  execute function set_updated_at();

-- Every organization gets a settings row for free.
create or replace function handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into organization_settings (organization_id) values (new.id);
  return new;
end;
$$;

create trigger on_organization_created
  after insert on organizations
  for each row
  execute function handle_new_organization();
