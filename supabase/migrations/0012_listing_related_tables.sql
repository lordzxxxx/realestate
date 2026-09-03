-- Phase 2: images, private contacts, amenities, history, revisions
-- (sections 12, 13, 46, 48, 54, 58)

create table listing_images (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references listings (id) on delete cascade,
  storage_path  text not null, -- path within the 'listing-images' Storage bucket
  sort_order    integer not null default 0,
  is_cover      boolean not null default false,
  alt_text      text,
  caption       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references profiles (id)
);

create index listing_images_listing_id_idx on listing_images (listing_id, sort_order);

create trigger listing_images_set_updated_at
  before update on listing_images
  for each row
  execute function set_updated_at();

-- Exactly one cover image per listing (enforced via partial unique index
-- rather than application logic, so it holds even under concurrent writes).
create unique index listing_images_one_cover_idx on listing_images (listing_id) where is_cover;

-- PRIVATE contact info (section 12) — owner/key-holder/representative.
-- Deliberately a separate table from listings, never joined into any public
-- read path; gated by listing.view_private_contacts in RLS (0013).
create type listing_contact_type as enum ('OWNER', 'KEY_HOLDER', 'REPRESENTATIVE');

create table listing_contacts (
  id                    uuid primary key default gen_random_uuid(),
  listing_id            uuid not null references listings (id) on delete cascade,
  contact_type          listing_contact_type not null,
  name                  text not null,
  email                 citext,
  phone                 text,
  messenger             text,
  company               text,
  viewing_instructions  text,
  access_instructions   text,
  internal_notes        text,
  commission_info       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references profiles (id),
  updated_by            uuid references profiles (id)
);

create index listing_contacts_listing_id_idx on listing_contacts (listing_id);

create trigger listing_contacts_set_updated_at
  before update on listing_contacts
  for each row
  execute function set_updated_at();

-- Amenities / nearby locations (sections 11, 46). A small shared master list
-- (seeded in 0016) plus ad-hoc custom entries any org can add inline.
create type amenity_kind as enum ('AMENITY', 'NEARBY');

create table amenities (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label       text not null,
  kind        amenity_kind not null,
  is_system   boolean not null default false
);

create table listing_amenities (
  listing_id    uuid not null references listings (id) on delete cascade,
  amenity_id    uuid not null references amenities (id) on delete cascade,
  distance_note text, -- e.g. "5 min drive" — only meaningful for NEARBY kind
  primary key (listing_id, amenity_id)
);

-- Status history (sections 14, 54) — append-only audit of every transition.
create table listing_status_history (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references listings (id) on delete cascade,
  from_status   listing_status,
  to_status     listing_status not null,
  note          text,
  changed_by    uuid references profiles (id),
  changed_at    timestamptz not null default now()
);

create index listing_status_history_listing_id_idx on listing_status_history (listing_id, changed_at);

-- Revisions (sections 48, 49) — full snapshot per meaningful change, so an
-- in-flight async job (Phase 5) can detect it's about to sync stale data.
create table listing_revisions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references listings (id) on delete cascade,
  version       integer not null,
  snapshot      jsonb not null,
  changed_by    uuid references profiles (id),
  created_at    timestamptz not null default now(),
  unique (listing_id, version)
);

create index listing_revisions_listing_id_idx on listing_revisions (listing_id, version);
