-- Phase 7: Facebook Page integration (sections 25-28, 52, 58)
--
-- Unlike Phase 6's shared Google service account, a Facebook Page can only
-- be posted to with a token authorized for that specific Page — there is no
-- platform-level credential that works across every organization. Rather
-- than build a full Facebook Login OAuth flow (a registered Meta App,
-- redirect handling, short-lived-to-long-lived token exchange, eventual App
-- Review for page permissions — none of which is exercisable in this
-- sandbox without a real Meta App anyway), an org admin pastes their own
-- Page ID and a long-lived Page Access Token, obtained externally (Meta
-- Business Suite / Graph API Explorer). Same "paste a credential you
-- generated yourself" spirit as Phase 6's spreadsheet ID, but the token
-- itself is a real secret — see the column-level lockdown below.

create table facebook_page_connections (
  organization_id uuid primary key references organizations (id),
  page_id         text,
  page_name       text, -- populated by "Test connection" (Graph API), not client-typed
  access_token    text, -- WRITE-ONLY from the client's perspective — see grants below
  status          text not null default 'DISCONNECTED' check (status in ('DISCONNECTED', 'CONNECTED', 'ERROR')),
  last_checked_at timestamptz,
  last_synced_at  timestamptz,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references profiles (id)
);

create trigger facebook_page_connections_set_updated_at
  before update on facebook_page_connections
  for each row
  execute function set_updated_at();

-- Same mapping idea as Phase 6's sheet_sync_records: which Facebook post
-- already represents a given listing, so a later change edits that post's
-- message instead of creating a second, duplicate post for the same
-- listing every time it's updated.
create table facebook_post_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  listing_id      uuid not null references listings (id),
  post_id         text not null,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, listing_id)
);

create index facebook_post_records_organization_id_idx on facebook_post_records (organization_id);

create trigger facebook_post_records_set_updated_at
  before update on facebook_post_records
  for each row
  execute function set_updated_at();

-- RLS ---------------------------------------------------------------

alter table facebook_page_connections enable row level security;
alter table facebook_post_records enable row level security;

create policy facebook_page_connections_select on facebook_page_connections
  for select
  to authenticated
  using (has_permission(auth.uid(), 'integrations.view', organization_id));

create policy facebook_page_connections_manage on facebook_page_connections
  for all
  to authenticated
  using (
    has_permission(auth.uid(), 'integrations.manage', organization_id)
    or has_permission(auth.uid(), 'integrations.facebook', organization_id)
  )
  with check (
    has_permission(auth.uid(), 'integrations.manage', organization_id)
    or has_permission(auth.uid(), 'integrations.facebook', organization_id)
  );

-- access_token is a real secret (a live Facebook Page Access Token, not an
-- identifier like Phase 6's spreadsheet ID) — column-level lockdown on top
-- of the row-level policy above, same technique as profiles.status (0009):
-- revoke the broad default-privilege grant entirely, then grant back only
-- the safe columns for SELECT. UPDATE stays granted on every column
-- (including access_token — that's how a client *sets* the token; Postgres
-- doesn't require SELECT on a column to blindly overwrite it), so staff can
-- rotate a token but never read one back — not through this table, not
-- through `.select()` after an update, not at all. Only the worker's
-- service-role client (which bypasses grants entirely) ever reads it, to
-- actually call the Graph API.
revoke select on facebook_page_connections from authenticated, anon;
grant select (
  organization_id, page_id, page_name, status,
  last_checked_at, last_synced_at, last_error,
  created_at, updated_at, updated_by
) on facebook_page_connections to authenticated;

-- facebook_post_records is purely internal bookkeeping for the worker —
-- staff can view it (useful for debugging) but never write it directly;
-- only the worker (service role) maintains the mapping.
create policy facebook_post_records_select on facebook_post_records
  for select
  to authenticated
  using (has_permission(auth.uid(), 'integrations.view', organization_id));

revoke insert, update, delete on facebook_post_records from authenticated, anon;

-- Every organization gets a (disconnected) row for free — same pattern as
-- organization_settings (0005) and google_sheet_connections (0023).
create or replace function handle_new_organization_facebook_connection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into facebook_page_connections (organization_id) values (new.id);
  return new;
end;
$$;

create trigger on_organization_created_facebook_connection
  after insert on organizations
  for each row
  execute function handle_new_organization_facebook_connection();

-- Backfill for organizations created before this migration.
insert into facebook_page_connections (organization_id)
select id from organizations
on conflict (organization_id) do nothing;

-- Changing which Page/token an org points at must not silently keep
-- reporting CONNECTED for credentials nobody has verified yet — force an
-- explicit re-test, same as Phase 6's google_sheet_connections (0024).
-- page_name is cleared too: it was fetched from the *old* token/page and is
-- now stale.
create or replace function facebook_page_connections_reset_on_target_change()
returns trigger
language plpgsql
as $$
begin
  if new.page_id is distinct from old.page_id
     or new.access_token is distinct from old.access_token then
    new.status := 'DISCONNECTED';
    new.page_name := null;
    new.last_error := null;
  end if;
  return new;
end;
$$;

create trigger facebook_page_connections_before_update_reset
  before update on facebook_page_connections
  for each row
  execute function facebook_page_connections_reset_on_target_change();
