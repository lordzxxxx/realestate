-- Phase 2: listings (sections 11, 58, 67-69)

create table listings (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id),

  listing_number        text not null unique, -- e.g. RENT-2026-000001, auto-generated
  slug                  text not null unique, -- e.g. six-senses-tower-3-unit-18b

  listing_type          listing_type not null,
  property_type         property_type not null,
  property_name         text not null,
  title                 text,
  description           text,

  -- Unit details
  bedrooms              smallint check (bedrooms is null or bedrooms >= 0),
  bathrooms             numeric(3, 1) check (bathrooms is null or bathrooms >= 0),
  has_balcony           boolean not null default false,
  tower                 text,
  building              text,
  floor                 text,
  unit_number           text,
  floor_area            numeric(10, 2) check (floor_area is null or floor_area >= 0),
  lot_area              numeric(10, 2) check (lot_area is null or lot_area >= 0),
  furnishing            furnishing_type,
  has_parking           boolean not null default false,
  parking_slots         smallint check (parking_slots is null or parking_slots >= 0),

  -- Price
  monthly_rent          numeric(12, 2) check (monthly_rent is null or monthly_rent >= 0),
  selling_price         numeric(14, 2) check (selling_price is null or selling_price >= 0),
  association_dues      numeric(10, 2) check (association_dues is null or association_dues >= 0),
  security_deposit      numeric(12, 2) check (security_deposit is null or security_deposit >= 0),
  advance               numeric(12, 2) check (advance is null or advance >= 0),
  payment_terms         text,
  is_negotiable         boolean not null default false,

  -- Location
  country               text not null default 'Philippines',
  province              text,
  city                  text,
  barangay              text,
  full_address          text,
  latitude              numeric(9, 6),
  longitude             numeric(9, 6),

  -- Workflow / status
  status                listing_status not null default 'DRAFT',
  assigned_agent_id     uuid references profiles (id),

  -- Publication control (section 74) — defaults ON, management can flip per listing
  website_enabled       boolean not null default true,
  facebook_enabled      boolean not null default true,
  google_sheets_enabled boolean not null default true,
  auto_sync_enabled     boolean not null default true,

  -- SEO (section 16)
  seo_title             text,
  seo_description       text,

  -- Automatic timestamps (section 69) — set only by set_listing_status()
  last_verified_at      timestamptz,
  submitted_at          timestamptz,
  approved_at           timestamptz,
  published_at          timestamptz,
  reserved_at           timestamptz,
  rented_at             timestamptz,
  sold_at               timestamptz,
  archived_at           timestamptz,

  -- Race-condition protection for async sync jobs (section 49, used from Phase 5)
  version               integer not null default 1,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references profiles (id),
  updated_by            uuid references profiles (id)
);

create index listings_organization_id_idx on listings (organization_id);
create index listings_status_idx on listings (status);
create index listings_assigned_agent_id_idx on listings (assigned_agent_id);
create index listings_listing_type_idx on listings (listing_type);
create index listings_property_type_idx on listings (property_type);
create index listings_city_idx on listings (city);
create index listings_slug_idx on listings (slug);

create trigger listings_set_updated_at
  before update on listings
  for each row
  execute function set_updated_at();

-- Auto-generated sequential listing numbers (section 67): RENT-2026-000001.
-- A plain table + atomic upsert-increment avoids needing DDL (CREATE SEQUENCE)
-- per listing_type/year combination at runtime.
create table listing_number_counters (
  counter_key   text primary key, -- e.g. 'RENT-2026'
  last_value    bigint not null default 0
);

create or replace function next_listing_number(p_listing_type listing_type)
returns text
language plpgsql
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_key text := p_listing_type::text || '-' || v_year;
  v_next bigint;
begin
  insert into listing_number_counters (counter_key, last_value)
  values (v_key, 1)
  on conflict (counter_key) do update set last_value = listing_number_counters.last_value + 1
  returning last_value into v_next;

  return v_key || '-' || lpad(v_next::text, 6, '0');
end;
$$;

create or replace function unique_listing_slug(p_base text)
returns text
language plpgsql
as $$
declare
  v_base text := coalesce(nullif(regexp_replace(lower(trim(p_base)), '[^a-z0-9]+', '-', 'g'), ''), 'listing');
  v_candidate text;
  v_suffix int := 1;
begin
  v_base := trim(both '-' from v_base);
  v_candidate := v_base;

  while exists (select 1 from listings where slug = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
  end loop;

  return v_candidate;
end;
$$;

create or replace function handle_new_listing()
returns trigger
language plpgsql
as $$
begin
  if new.listing_number is null or new.listing_number = '' then
    new.listing_number := next_listing_number(new.listing_type);
  end if;

  if new.slug is null or new.slug = '' then
    new.slug := unique_listing_slug(
      new.property_name || coalesce('-' || new.building, '') || coalesce('-unit-' || new.unit_number, '')
    );
  end if;

  -- INSERT has no column-level privilege restriction the way UPDATE does
  -- (0013 only locks down UPDATE on status/approval/timestamp columns), so
  -- without this a client could INSERT a listing that's already
  -- AVAILABLE/SOLD/ARCHIVED with fabricated approval timestamps, skipping
  -- the entire review workflow. Every listing starts life as a fresh DRAFT
  -- regardless of what the client sends.
  new.status := 'DRAFT';
  new.version := 1;
  new.submitted_at := null;
  new.approved_at := null;
  new.published_at := null;
  new.reserved_at := null;
  new.rented_at := null;
  new.sold_at := null;
  new.archived_at := null;
  new.last_verified_at := null;

  return new;
end;
$$;

create trigger listings_before_insert
  before insert on listings
  for each row
  execute function handle_new_listing();
