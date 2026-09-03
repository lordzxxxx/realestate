-- Phase 6: Google Sheets integration (sections 25-28, 52, 58)
--
-- Shared service-account model (not per-org OAuth): one platform-level
-- credential (GOOGLE_SERVICE_ACCOUNT_KEY, configured outside the DB) calls
-- the Sheets API on behalf of every organization. An org "connects" by
-- pasting a spreadsheet ID and sharing edit access with the service
-- account's email — no authorization-code exchange or refresh tokens to
-- store here.

create table google_sheet_connections (
  organization_id     uuid primary key references organizations (id),
  spreadsheet_id      text,
  property_sheet_name text not null default 'Property Master Directory',
  status              text not null default 'DISCONNECTED' check (status in ('DISCONNECTED', 'CONNECTED', 'ERROR')),
  last_checked_at     timestamptz,
  last_synced_at      timestamptz,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references profiles (id)
);

create trigger google_sheet_connections_set_updated_at
  before update on google_sheet_connections
  for each row
  execute function set_updated_at();

-- Section 27: "Use Listing ID as the stable mapping key. Do NOT keep
-- appending duplicates." This table is that mapping — which spreadsheet row
-- a given listing already occupies, so a later sync updates in place
-- instead of appending a second row.
create table sheet_sync_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  listing_id      uuid not null references listings (id),
  row_number      integer not null,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, listing_id)
);

create index sheet_sync_records_organization_id_idx on sheet_sync_records (organization_id);

create trigger sheet_sync_records_set_updated_at
  before update on sheet_sync_records
  for each row
  execute function set_updated_at();

-- RLS ---------------------------------------------------------------

alter table google_sheet_connections enable row level security;
alter table sheet_sync_records enable row level security;

create policy google_sheet_connections_select on google_sheet_connections
  for select
  to authenticated
  using (has_permission(auth.uid(), 'integrations.view', organization_id));

create policy google_sheet_connections_manage on google_sheet_connections
  for all
  to authenticated
  using (
    has_permission(auth.uid(), 'integrations.manage', organization_id)
    or has_permission(auth.uid(), 'integrations.google', organization_id)
  )
  with check (
    has_permission(auth.uid(), 'integrations.manage', organization_id)
    or has_permission(auth.uid(), 'integrations.google', organization_id)
  );

-- sheet_sync_records is purely internal bookkeeping for the worker — staff
-- can view it (useful for debugging a sync issue) but never write it
-- directly; only the worker (service role) maintains the mapping.
create policy sheet_sync_records_select on sheet_sync_records
  for select
  to authenticated
  using (has_permission(auth.uid(), 'integrations.view', organization_id));

revoke insert, update, delete on sheet_sync_records from authenticated, anon;

-- Every organization gets a (disconnected) row for free, same pattern as
-- organization_settings (0005) — so the settings page always has a row to
-- read/update rather than needing separate create-vs-update logic.
create or replace function handle_new_organization_sheets_connection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into google_sheet_connections (organization_id) values (new.id);
  return new;
end;
$$;

create trigger on_organization_created_sheets_connection
  after insert on organizations
  for each row
  execute function handle_new_organization_sheets_connection();

-- Backfill for organizations created before this migration.
insert into google_sheet_connections (organization_id)
select id from organizations
on conflict (organization_id) do nothing;
