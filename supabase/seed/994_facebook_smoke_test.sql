-- Local smoke test only. Depends on 999/998/997/996/995 having run first
-- (reuses their org/users). Verifies: auto-provisioning, the column-level
-- REVOKE on access_token actually blocks SELECT (not just RLS row-scoping
-- — this is the real difference from Phase 6, where nothing stored was a
-- secret), the listing-change dispatch trigger only fires for a listing
-- that's genuinely publicly visible AND once CONNECTED, changing the
-- target resets status, and retry_sync_job() is permission-checked and
-- only operates on dead-lettered jobs.

\set ON_ERROR_STOP on

-- 1. Baseline: connection exists (auto-provisioned), still DISCONNECTED.
select status, page_id is null as no_page_yet from facebook_page_connections
  where organization_id = (select id from organizations where slug = 'main-realty-co');

-- 2. A listing that's genuinely publicly visible (AVAILABLE, website
--    enabled) but with the connection still DISCONNECTED must NOT queue a
--    FACEBOOK_UPSERT_POST job.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222'; -- trusted agent (publish_directly) from 998

do $$
declare
  v_org_id uuid := (select id from organizations where slug = 'main-realty-co');
  v_listing_id uuid;
begin
  insert into listings (organization_id, listing_type, property_type, property_name, monthly_rent, created_by)
  values (v_org_id, 'RENT', 'CONDOMINIUM', 'Facebook Smoke Test Unit', 25000, '22222222-2222-2222-2222-222222222222')
  returning id into v_listing_id;

  perform set_config('reos.fb_listing_id', v_listing_id::text, false);
end $$;

-- Trusted agent's submit_listing() skips review and lands directly on
-- AVAILABLE (same shortcut exercised in 998) — this listing is now
-- genuinely publicly visible.
select (submit_listing(current_setting('reos.fb_listing_id')::uuid)).status as listing_is_available;

reset role;
reset request.jwt.uid;

select count(*) as no_job_while_disconnected from sync_jobs
  where listing_id = current_setting('reos.fb_listing_id')::uuid and job_type = 'FACEBOOK_UPSERT_POST';

-- 3. An ordinary agent (no integrations.manage/facebook) cannot connect a
--    Page; the SUPER_ADMIN (global integrations.manage) can.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

do $$
begin
  begin
    update facebook_page_connections set page_id = 'evil-page'
    where organization_id = (select id from organizations where slug = 'main-realty-co');
    if found then raise exception 'SECURITY BUG: agent connected a Facebook Page without integrations.manage/facebook'; end if;
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: connection update blocked or no-op for plain agent (%)', sqlerrm;
  end;
end $$;

-- 4. The real new guarantee this phase adds: even someone who legitimately
--    holds integrations.view (the trusted agent doesn't, so use the
--    SUPER_ADMIN instead) cannot SELECT access_token AT ALL as role
--    `authenticated` — this is a Postgres column-level REVOKE, a stronger
--    guarantee than "no RLS policy grants this row", and holds regardless
--    of what RBAC permissions the session's app-level user has.
reset role;
reset request.jwt.uid;

set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111'; -- SUPER_ADMIN, global integrations.manage

do $$
begin
  begin
    perform access_token from facebook_page_connections
    where organization_id = (select id from organizations where slug = 'main-realty-co');
    raise exception 'SECURITY BUG: authenticated role could SELECT access_token despite the column-level REVOKE';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: SELECT access_token blocked at the column level, even for integrations.manage (%)', sqlerrm;
  end;
end $$;

-- 5. Two separate statements, deliberately (same discipline as Phase 6):
--    "Save settings" (page_id/access_token) never sets status in the same
--    statement — the before-update trigger would reset it right back to
--    DISCONNECTED, since it can't tell "explicitly requested CONNECTED"
--    from "status just carried over".
update facebook_page_connections
set page_id = 'smoke-test-page-id', access_token = 'smoke-test-token'
where organization_id = (select id from organizations where slug = 'main-realty-co');

update facebook_page_connections
set status = 'CONNECTED', page_name = 'Smoke Test Realty', last_checked_at = now(), last_error = null
where organization_id = (select id from organizations where slug = 'main-realty-co');

select status, page_id, page_name from facebook_page_connections
  where organization_id = (select id from organizations where slug = 'main-realty-co');

reset role;
reset request.jwt.uid;

-- 6. Now that the connection is CONNECTED, saving that same (still
--    publicly-visible) listing again must queue exactly one
--    FACEBOOK_UPSERT_POST job, carrying the denormalized payload the
--    worker needs.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

update listings set monthly_rent = 26000 where id = current_setting('reos.fb_listing_id')::uuid;

reset role;
reset request.jwt.uid;

select count(*) as one_job_once_connected from sync_jobs
  where listing_id = current_setting('reos.fb_listing_id')::uuid and job_type = 'FACEBOOK_UPSERT_POST';

select payload ->> 'page_id' as payload_page_id,
       (payload ->> 'monthly_rent')::numeric as payload_monthly_rent
  from sync_jobs
  where listing_id = current_setting('reos.fb_listing_id')::uuid and job_type = 'FACEBOOK_UPSERT_POST'
  order by created_at desc limit 1;

-- 7. Changing the Page/token resets status to DISCONNECTED and clears the
--    now-stale page_name.
set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';

update facebook_page_connections set page_id = 'a-different-page-id'
where organization_id = (select id from organizations where slug = 'main-realty-co');

select status = 'DISCONNECTED' as reset_to_disconnected_on_target_change,
       page_name is null as page_name_cleared
  from facebook_page_connections where organization_id = (select id from organizations where slug = 'main-realty-co');

-- Reconnect for the remaining checks.
update facebook_page_connections set status = 'CONNECTED'
where organization_id = (select id from organizations where slug = 'main-realty-co');

reset role;
reset request.jwt.uid;

-- 8. retry_sync_job(): permission-checked, and only operates on jobs that
--    are actually dead-lettered — reuses the same retry->dead-letter drill
--    as 996's complete_sync_job coverage to get a job into that state.
--
-- Job ids are captured into session GUCs (set_config/current_setting) while
-- still unrestricted, never looked up via a fresh SELECT once posing as the
-- plain agent below — that agent has no integrations.view, so
-- sync_jobs_select's RLS policy would hide the row from such a SELECT
-- entirely, resolving it to NULL and making "blocked because not found"
-- look identical to "blocked by permission" (a real trap: it would make
-- the test pass even if retry_sync_job()'s own permission check were
-- deleted). current_setting() only reads a session value, never queries
-- the table, so it can't be silently defeated by RLS this way. (Also
-- avoids relying on psql's own `:'var' \gset` substitution, which does NOT
-- work inside `do $$ ... $$` blocks — it only rewrites the script's plain
-- SQL text, not the contents of a dollar-quoted string.)
do $$
declare
  v_id uuid;
begin
  v_id := enqueue_sync_job(
    (select id from organizations where slug = 'main-realty-co'), null, null,
    'FACEBOOK_UPSERT_POST', 'FACEBOOK', '{}'::jsonb, 'smoke-facebook-retry-lifecycle'
  );
  perform set_config('reos.fb_retry_job_id', v_id::text, false);
end $$;

select status, attempt_count from complete_sync_job(current_setting('reos.fb_retry_job_id')::uuid, false, 'fail 1');
select status, attempt_count from complete_sync_job(current_setting('reos.fb_retry_job_id')::uuid, false, 'fail 2');
select status, attempt_count from complete_sync_job(current_setting('reos.fb_retry_job_id')::uuid, false, 'fail 3');
select status from complete_sync_job(current_setting('reos.fb_retry_job_id')::uuid, false, 'fail 4 - must dead-letter');

reset role;
reset request.jwt.uid;

-- Not dead-lettered yet? Prove retry_sync_job() refuses a QUEUED/PROCESSING
-- job too, not just wrong-permission callers.
do $$
declare
  v_id uuid;
begin
  v_id := enqueue_sync_job(
    (select id from organizations where slug = 'main-realty-co'), null, null,
    'FACEBOOK_UPSERT_POST', 'FACEBOOK', '{}'::jsonb, 'smoke-facebook-not-dead-lettered'
  );
  perform set_config('reos.fb_queued_job_id', v_id::text, false);
end $$;

set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';

do $$
begin
  begin
    perform retry_sync_job(current_setting('reos.fb_queued_job_id')::uuid);
    raise exception 'SECURITY BUG: retry_sync_job() retried a job that was not dead-lettered';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: retry_sync_job() refused a non-dead-lettered job (%)', sqlerrm;
  end;
end $$;

reset role;
reset request.jwt.uid;

-- Plain agent (no integrations.retry/manage) cannot retry the dead-lettered
-- job either.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

do $$
begin
  begin
    perform retry_sync_job(current_setting('reos.fb_retry_job_id')::uuid);
    raise exception 'SECURITY BUG: plain agent retried a sync job without integrations.retry/manage';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: retry_sync_job() blocked for plain agent (%)', sqlerrm;
  end;
end $$;

reset role;
reset request.jwt.uid;

-- SUPER_ADMIN retries it successfully — back to QUEUED, attempt_count reset.
set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';

select status, attempt_count from retry_sync_job(current_setting('reos.fb_retry_job_id')::uuid);

reset role;
reset request.jwt.uid;

select 'FACEBOOK SMOKE TEST COMPLETE' as result;
