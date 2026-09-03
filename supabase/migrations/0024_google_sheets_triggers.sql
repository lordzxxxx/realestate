-- Phase 6: Google Sheets sync dispatch (sections 25-28, 52, 58)
--
-- Same outbox pattern as Phase 5: a listing insert/update enqueues a
-- SHEETS_UPSERT_ROW job in the same transaction: it never depends on the
-- calling code remembering to do it. The worker (0022's process-jobs route)
-- claims and processes these asynchronously via the real Sheets API client.

-- Changing which spreadsheet an org points at must not silently keep
-- reporting CONNECTED for a sheet nobody has verified yet — force an
-- explicit re-test (section 26: "Test Connection" button) after any change.
create or replace function google_sheet_connections_reset_on_target_change()
returns trigger
language plpgsql
as $$
begin
  if new.spreadsheet_id is distinct from old.spreadsheet_id
     or new.property_sheet_name is distinct from old.property_sheet_name then
    new.status := 'DISCONNECTED';
    new.last_error := null;
  end if;
  return new;
end;
$$;

create trigger google_sheet_connections_before_update_reset
  before update on google_sheet_connections
  for each row
  execute function google_sheet_connections_reset_on_target_change();

-- LISTINGS: dispatch a sync job whenever a listing that opts into sheets
-- sync (section 25's per-listing toggles, already columns on `listings`
-- since 0010) changes, the org hasn't turned the whole integration off
-- (organization_settings.auto_sync_google_sheets, 0005 — predates this
-- phase but nothing before now actually consulted it), and the org has a
-- verified connection.
create or replace function listings_emit_sheets_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_sync_enabled boolean;
  v_connection record;
  v_agent_name text;
  v_event_id uuid;
begin
  if not (new.google_sheets_enabled and new.auto_sync_enabled) then
    return new;
  end if;

  select auto_sync_google_sheets into v_org_sync_enabled
  from organization_settings
  where organization_id = new.organization_id;

  if v_org_sync_enabled is distinct from true then
    return new;
  end if;

  select spreadsheet_id, property_sheet_name, status into v_connection
  from google_sheet_connections
  where organization_id = new.organization_id;

  if v_connection is null or v_connection.status is distinct from 'CONNECTED' or v_connection.spreadsheet_id is null then
    return new;
  end if;

  if new.assigned_agent_id is not null then
    select full_name into v_agent_name from profiles where id = new.assigned_agent_id;
  end if;

  v_event_id := create_automation_event(new.organization_id, 'LISTING_SHEETS_SYNC_REQUESTED', 'listing', new.id, new.updated_by,
    jsonb_build_object('property_name', new.property_name));

  -- Keyed on new.version (same convention as 0021's other listing triggers):
  -- a trivial re-save with no real change still bumps version, so this
  -- still queues a fresh sync, which is exactly what "keep the sheet in
  -- sync with every listing change" (section 25) asks for.
  perform enqueue_sync_job(
    new.organization_id,
    new.id,
    v_event_id,
    'SHEETS_UPSERT_ROW',
    'GOOGLE_SHEETS',
    jsonb_build_object(
      'spreadsheet_id', v_connection.spreadsheet_id,
      'sheet_name', v_connection.property_sheet_name,
      'listing_id', new.id,
      'listing_number', new.listing_number,
      'status', new.status,
      'listing_type', new.listing_type,
      'property_type', new.property_type,
      'property_name', new.property_name,
      'bedrooms', new.bedrooms,
      'bathrooms', new.bathrooms,
      'floor_area', new.floor_area,
      'monthly_rent', new.monthly_rent,
      'selling_price', new.selling_price,
      'city', new.city,
      'province', new.province,
      'assigned_agent_name', v_agent_name,
      'last_verified_at', new.last_verified_at,
      'updated_at', new.updated_at,
      'slug', new.slug
    ),
    'sheets_upsert:' || new.id || ':' || new.version
  );

  return new;
end;
$$;

create trigger listings_after_emit_sheets_sync
  after insert or update on listings
  for each row
  execute function listings_emit_sheets_sync();

-- Manual "Sync all now" (section 26 reconciliation): re-queues every
-- eligible listing in the org even if nothing changed since its last sync
-- (e.g. after fixing a cell someone edited by hand, or right after
-- reconnecting). Callable directly by staff, so — unlike 0020's helpers —
-- it checks permission internally instead of being revoked outright.
create or replace function reconcile_google_sheets(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid := gen_random_uuid();
  v_org_sync_enabled boolean;
  v_connection record;
  v_listing record;
  v_agent_name text;
  v_event_id uuid;
  v_count integer := 0;
begin
  if not (has_permission(auth.uid(), 'integrations.manage', p_organization_id)
          or has_permission(auth.uid(), 'integrations.google', p_organization_id)
          or has_permission(auth.uid(), 'integrations.retry', p_organization_id)) then
    raise exception 'permission integrations.manage or integrations.google or integrations.retry required' using errcode = '42501';
  end if;

  select auto_sync_google_sheets into v_org_sync_enabled
  from organization_settings
  where organization_id = p_organization_id;

  if v_org_sync_enabled is distinct from true then
    raise exception 'organization % has Google Sheets auto-sync disabled in settings' , p_organization_id using errcode = '42501';
  end if;

  select spreadsheet_id, property_sheet_name, status into v_connection
  from google_sheet_connections
  where organization_id = p_organization_id;

  if v_connection is null or v_connection.status is distinct from 'CONNECTED' or v_connection.spreadsheet_id is null then
    raise exception 'organization % has no CONNECTED Google Sheets connection', p_organization_id using errcode = '42501';
  end if;

  for v_listing in
    select * from listings
    where organization_id = p_organization_id
      and google_sheets_enabled and auto_sync_enabled
  loop
    v_agent_name := null;
    if v_listing.assigned_agent_id is not null then
      select full_name into v_agent_name from profiles where id = v_listing.assigned_agent_id;
    end if;

    v_event_id := create_automation_event(p_organization_id, 'LISTING_SHEETS_SYNC_REQUESTED', 'listing', v_listing.id, auth.uid(),
      jsonb_build_object('property_name', v_listing.property_name, 'reconcile_run_id', v_run_id));

    perform enqueue_sync_job(
      p_organization_id,
      v_listing.id,
      v_event_id,
      'SHEETS_UPSERT_ROW',
      'GOOGLE_SHEETS',
      jsonb_build_object(
        'spreadsheet_id', v_connection.spreadsheet_id,
        'sheet_name', v_connection.property_sheet_name,
        'listing_id', v_listing.id,
        'listing_number', v_listing.listing_number,
        'status', v_listing.status,
        'listing_type', v_listing.listing_type,
        'property_type', v_listing.property_type,
        'property_name', v_listing.property_name,
        'bedrooms', v_listing.bedrooms,
        'bathrooms', v_listing.bathrooms,
        'floor_area', v_listing.floor_area,
        'monthly_rent', v_listing.monthly_rent,
        'selling_price', v_listing.selling_price,
        'city', v_listing.city,
        'province', v_listing.province,
        'assigned_agent_name', v_agent_name,
        'last_verified_at', v_listing.last_verified_at,
        'updated_at', v_listing.updated_at,
        'slug', v_listing.slug
      ),
      'sheets_reconcile:' || v_listing.id || ':' || v_run_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
