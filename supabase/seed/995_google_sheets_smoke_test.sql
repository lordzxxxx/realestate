-- Local smoke test only. Depends on 999/998/997/996 having run first (reuses
-- their org/users/listings). Verifies: auto-provisioning, RLS/write lockdown
-- (already covered inline right after 0023 during manual validation, but
-- re-checked here as part of the standard chain), the listing-change
-- dispatch trigger only fires once a connection is actually CONNECTED,
-- changing the spreadsheet target resets status to DISCONNECTED, and
-- reconcile_google_sheets() is permission-checked and force-requeues.

\set ON_ERROR_STOP on

-- 1. Baseline: connection exists (auto-provisioned), still DISCONNECTED.
select status, spreadsheet_id is null as no_spreadsheet_yet from google_sheet_connections
  where organization_id = (select id from organizations where slug = 'main-realty-co');

-- 2. While DISCONNECTED, saving a listing must NOT queue a SHEETS_UPSERT_ROW
--    job — there's nowhere to sync it to yet.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222'; -- trusted agent from 998

do $$
declare
  v_org_id uuid := (select id from organizations where slug = 'main-realty-co');
  v_listing_id uuid;
begin
  insert into listings (organization_id, listing_type, property_type, property_name, monthly_rent, created_by)
  values (v_org_id, 'RENT', 'CONDOMINIUM', 'Sheets Smoke Test Unit', 18000, '22222222-2222-2222-2222-222222222222')
  returning id into v_listing_id;

  perform set_config('reos.sheets_listing_id', v_listing_id::text, false);
end $$;

reset role;
reset request.jwt.uid;

select count(*) as no_job_while_disconnected from sync_jobs
  where listing_id = current_setting('reos.sheets_listing_id')::uuid and job_type = 'SHEETS_UPSERT_ROW';

-- 3. An ordinary agent (no integrations.manage/google) cannot connect a
--    sheet; the SUPER_ADMIN (global integrations.manage) can.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

do $$
begin
  begin
    update google_sheet_connections set spreadsheet_id = 'evil-sheet'
    where organization_id = (select id from organizations where slug = 'main-realty-co');
    if found then raise exception 'SECURITY BUG: agent connected a Google Sheet without integrations.manage/google'; end if;
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: connection update blocked or no-op for plain agent (%)', sqlerrm;
  end;
end $$;

reset role;
reset request.jwt.uid;

set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111'; -- SUPER_ADMIN from 998

-- Two separate statements, deliberately: this is how the real app does it
-- too ("Save settings" only ever touches spreadsheet_id/sheet_name; "Test
-- connection" only ever touches status/last_checked_at/last_error). Setting
-- both in the SAME statement would have the before-update trigger (which
-- can't distinguish "client explicitly requested CONNECTED" from "status
-- just carried over") immediately reset status back to DISCONNECTED.
update google_sheet_connections
set spreadsheet_id = 'smoke-test-spreadsheet-id'
where organization_id = (select id from organizations where slug = 'main-realty-co');

update google_sheet_connections
set status = 'CONNECTED', last_checked_at = now(), last_error = null
where organization_id = (select id from organizations where slug = 'main-realty-co');

select status, spreadsheet_id from google_sheet_connections
  where organization_id = (select id from organizations where slug = 'main-realty-co');

reset role;
reset request.jwt.uid;

-- 4. Now that the connection is CONNECTED, saving that same listing again
--    must queue exactly one SHEETS_UPSERT_ROW job, carrying the denormalized
--    payload the worker needs (no extra round-trip to look anything up).
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

update listings set monthly_rent = 19000 where id = current_setting('reos.sheets_listing_id')::uuid;

reset role;
reset request.jwt.uid;

select count(*) as one_job_once_connected from sync_jobs
  where listing_id = current_setting('reos.sheets_listing_id')::uuid and job_type = 'SHEETS_UPSERT_ROW';

select payload ->> 'spreadsheet_id' as payload_spreadsheet_id,
       payload ->> 'sheet_name' as payload_sheet_name,
       (payload ->> 'monthly_rent')::numeric as payload_monthly_rent
  from sync_jobs
  where listing_id = current_setting('reos.sheets_listing_id')::uuid and job_type = 'SHEETS_UPSERT_ROW'
  order by created_at desc limit 1;

-- 5. Changing the spreadsheet target resets status to DISCONNECTED (forces
--    an explicit re-test rather than silently trusting the new target).
set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';

update google_sheet_connections set spreadsheet_id = 'a-different-spreadsheet-id'
where organization_id = (select id from organizations where slug = 'main-realty-co');

select status = 'DISCONNECTED' as reset_to_disconnected_on_target_change
  from google_sheet_connections where organization_id = (select id from organizations where slug = 'main-realty-co');

-- Reconnect for the remaining checks.
update google_sheet_connections set status = 'CONNECTED'
where organization_id = (select id from organizations where slug = 'main-realty-co');

reset role;
reset request.jwt.uid;

-- 6. reconcile_google_sheets(): permission-checked (unlike 0020's helpers,
--    it's meant to be called directly), and force-requeues every eligible
--    listing even with nothing changed.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222'; -- plain agent: no integrations.* permission

do $$
begin
  begin
    perform reconcile_google_sheets((select id from organizations where slug = 'main-realty-co'));
    raise exception 'SECURITY BUG: plain agent invoked reconcile_google_sheets without integrations.manage/google/retry';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: reconcile_google_sheets blocked for plain agent (%)', sqlerrm;
  end;
end $$;

reset role;
reset request.jwt.uid;

set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';

select count(*) as jobs_before_reconcile from sync_jobs where job_type = 'SHEETS_UPSERT_ROW';
select reconcile_google_sheets((select id from organizations where slug = 'main-realty-co')) as reconciled_count;
select count(*) as jobs_after_reconcile from sync_jobs where job_type = 'SHEETS_UPSERT_ROW';

reset role;
reset request.jwt.uid;

select 'GOOGLE SHEETS SMOKE TEST COMPLETE' as result;
