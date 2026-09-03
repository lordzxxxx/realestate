-- Local smoke test only. Depends on 999/998/997 having run first (reuses
-- their org/users/listings). Verifies: automation_events + sync_jobs get
-- created by triggers, idempotency prevents duplicates, direct RPC calls by
-- ordinary users are blocked, atomic job claiming, the full
-- retry-then-dead-letter lifecycle, stuck-job reclamation, and RLS/column
-- lockdown on notifications.

\set ON_ERROR_STOP on

-- 1. A fresh listing walked to PENDING_REVIEW must produce a
--    LISTING_SUBMITTED automation_event and a queued SEND_NOTIFICATION job
--    addressed to whoever holds listing.approve in this org (the
--    SUPER_ADMIN bootstrap user, globally scoped).
set role authenticated;
set request.jwt.uid = '44444444-4444-4444-4444-444444444444'; -- untrusted EXTERNAL_AGENT from 998

do $$
declare
  v_org_id uuid := (select id from organizations where slug = 'main-realty-co');
  v_listing_id uuid;
begin
  insert into listings (organization_id, listing_type, property_type, property_name, monthly_rent, created_by)
  values (v_org_id, 'RENT', 'CONDOMINIUM', 'Automation Test Unit', 22000, '44444444-4444-4444-4444-444444444444')
  returning id into v_listing_id;

  perform set_config('reos.automation_listing_id', v_listing_id::text, false);
end $$;

select submit_listing(current_setting('reos.automation_listing_id')::uuid);

reset role;
reset request.jwt.uid;

select count(*) as submitted_event_exists from automation_events
  where resource_id = current_setting('reos.automation_listing_id')::uuid and event_type = 'LISTING_SUBMITTED';

select count(*) as notification_job_queued from sync_jobs
  where event_id = (select id from automation_events where resource_id = current_setting('reos.automation_listing_id')::uuid and event_type = 'LISTING_SUBMITTED')
    and job_type = 'SEND_NOTIFICATION'
    and status = 'QUEUED';

-- 2. Idempotency: calling enqueue_sync_job again with the same key is a
--    documented no-op (returns null, no second row).
select enqueue_sync_job(null, null, null, 'SEND_NOTIFICATION', 'INTERNAL', '{}'::jsonb, 'smoke-idempotency-key') as first_call_returns_id;
select enqueue_sync_job(null, null, null, 'SEND_NOTIFICATION', 'INTERNAL', '{}'::jsonb, 'smoke-idempotency-key') as second_call_returns_null;
select count(*) as exactly_one_row from sync_jobs where idempotency_key = 'smoke-idempotency-key';

-- 3. An ordinary authenticated user cannot call the internal automation
--    functions directly (they're revoked from authenticated/anon) — this is
--    the actual security boundary, not just "the UI doesn't expose a button".
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

do $$
begin
  begin
    perform enqueue_notification_job('11111111-1111-1111-1111-111111111111'::uuid, null, null, 'FAKE', 'x', 'y', 'z', 'forged');
    raise exception 'SECURITY BUG: authenticated user forged a notification job via RPC';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: enqueue_notification_job blocked for authenticated user (%)', sqlerrm;
  end;

  begin
    perform claim_next_sync_jobs(5);
    raise exception 'SECURITY BUG: authenticated user claimed jobs from the queue directly';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: claim_next_sync_jobs blocked for authenticated user (%)', sqlerrm;
  end;
end $$;

reset role;
reset request.jwt.uid;

-- 4. Atomic claiming: claim once, then re-claiming immediately must not
--    return the same jobs again (they're PROCESSING now, not QUEUED).
select count(*) as claimed_first_pass from claim_next_sync_jobs(50);
select count(*) as claimed_second_pass_should_be_zero from claim_next_sync_jobs(50)
  where id in (select id from sync_jobs where status = 'PROCESSING');

-- 5. Full retry -> dead-letter lifecycle on a dedicated test job. Captures
--    the new job's id directly from enqueue_sync_job's return value (does
--    not need to go through claim_next_sync_jobs — complete_sync_job works
--    regardless of the job's current status, as already exercised above).
select enqueue_sync_job(null, null, null, 'SEND_NOTIFICATION', 'INTERNAL', '{}'::jsonb, 'smoke-retry-lifecycle') as retry_id \gset

select status, attempt_count from complete_sync_job(:'retry_id'::uuid, false, 'fail 1');
select status, attempt_count from complete_sync_job(:'retry_id'::uuid, false, 'fail 2');
select status, attempt_count from complete_sync_job(:'retry_id'::uuid, false, 'fail 3');
select status, attempt_count, completed_at is not null as terminal
  from complete_sync_job(:'retry_id'::uuid, false, 'fail 4 - must dead-letter');

-- 4 entries: 3x job_retry_scheduled + 1x job_failed_requires_attention.
-- (No job_started entry here since this job went straight through
-- complete_sync_job without being claimed via claim_next_sync_jobs.)
select count(*) as four_log_entries from integration_logs where sync_job_id = :'retry_id'::uuid;

-- 6. Stuck-job reclamation.
select enqueue_sync_job(null, null, null, 'SEND_NOTIFICATION', 'INTERNAL', '{}'::jsonb, 'smoke-stuck-job');
update sync_jobs set status = 'PROCESSING', locked_at = now() - interval '1 hour' where idempotency_key = 'smoke-stuck-job';
select reclaim_stuck_sync_jobs('10 minutes') > 0 as reclaimed_at_least_one;
select status from sync_jobs where idempotency_key = 'smoke-stuck-job';

-- 7. RLS: the trusted agent (creator/assigned agent, no audit.view/
--    integrations.view) cannot see automation_events/sync_jobs at all; the
--    SUPER_ADMIN (has both, globally) can.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as agent_sees_automation_events from automation_events;
select count(*) as agent_sees_sync_jobs from sync_jobs;
reset role;
reset request.jwt.uid;

set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';
select count(*) > 0 as admin_sees_automation_events from automation_events;
reset role;
reset request.jwt.uid;

-- 8. Notifications: a user sees only their own; cannot insert/delete
--    directly; CAN mark their own read via the read_at column grant.
insert into notifications (user_id, type, title) values ('22222222-2222-2222-2222-222222222222', 'TEST', 'Test notification');

set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

select count(*) as owner_sees_own_notification from notifications where title = 'Test notification';

do $$
begin
  begin
    insert into notifications (user_id, type, title) values ('22222222-2222-2222-2222-222222222222', 'FORGED', 'x');
    raise exception 'SECURITY BUG: authenticated user inserted a notification directly';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: direct notification INSERT blocked (%)', sqlerrm;
  end;
end $$;

update notifications set read_at = now() where title = 'Test notification';
select read_at is not null as marked_read from notifications where title = 'Test notification';

reset role;
reset request.jwt.uid;

set role authenticated;
set request.jwt.uid = '55555555-5555-5555-5555-555555555555'; -- unrelated KEY_HOLDER outsider from 998
select count(*) as outsider_sees_others_notifications from notifications where title = 'Test notification';
reset role;
reset request.jwt.uid;

select 'AUTOMATION SMOKE TEST COMPLETE' as result;
