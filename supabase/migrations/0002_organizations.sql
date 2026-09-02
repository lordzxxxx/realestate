-- Phase 1: Organizations
-- Multi-organization architecture (section 6 / 51 of the master plan).

create type organization_status as enum ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

create table organizations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  logo_url          text,
  contact_email     citext,
  contact_phone     text,
  address           text,
  status            organization_status not null default 'ACTIVE',
  -- free-form org-level knobs not yet worth a dedicated column
  settings          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,
  archived_at       timestamptz
);

create index organizations_status_idx on organizations (status);
create index organizations_slug_idx on organizations (slug);

create trigger organizations_set_updated_at
  before update on organizations
  for each row
  execute function set_updated_at();
