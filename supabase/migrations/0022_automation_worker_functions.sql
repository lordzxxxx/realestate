-- Phase 5: worker-side claim/complete functions (sections 30, 32, 76-78)
--
-- Atomic job claiming (SKIP LOCKED) cannot be expressed through PostgREST's
-- REST API — there is no way to send "SELECT ... FOR UPDATE SKIP LOCKED"
-- through a supabase-js query builder call. This function is the only way
-- the worker can safely claim jobs without two overlapping cron runs (or a
-- retried request) both grabbing and processing the same job.
--
-- Not revoked from authenticated/anon the way 0020's helpers are: these are
-- meant to be called by the worker's service-role client, which already
-- bypasses grants entirely, but an ordinary authenticated user calling them
-- would only ever manipulate the shared job queue's bookkeeping (no data
-- exfiltration/privilege path) and could self-DoS the queue at worst. Still,
-- there is no legitimate reason for a client session to call these, so they
-- are revoked below for defense in depth.

create or replace function claim_next_sync_jobs(p_limit integer default 10)
returns setof sync_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job sync_jobs;
begin
  for v_job in
    update sync_jobs
    set status = 'PROCESSING',
        locked_at = now(),
        started_at = coalesce(started_at, now())
    where id in (
      select id from sync_jobs
      where (status = 'QUEUED' or (status = 'RETRY_SCHEDULED' and next_retry_at <= now()))
      order by priority, created_at
      limit p_limit
      for update skip locked
    )
    returning *
  loop
    insert into integration_logs (sync_job_id, organization_id, level, event, message)
    values (v_job.id, v_job.organization_id, 'INFO', 'job_started', 'Claimed job_type=' || v_job.job_type);
    return next v_job;
  end loop;
  return;
end;
$$;

revoke execute on function claim_next_sync_jobs(integer) from public, authenticated, anon;

-- Exponential-ish backoff: 1 min, 5 min, 15 min for attempts 1-3; the 4th
-- failure (== default max_attempts) dead-letters instead of scheduling
-- another retry (section 32: "Then: FAILED. Admin receives notification.").
create or replace function retry_delay_for_attempt(p_attempt integer)
returns interval
language sql
immutable
as $$
  select case p_attempt
    when 1 then interval '1 minute'
    when 2 then interval '5 minutes'
    when 3 then interval '15 minutes'
    else interval '60 minutes'
  end;
$$;

create or replace function complete_sync_job(
  p_job_id uuid,
  p_success boolean,
  p_error text default null
)
returns sync_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job sync_jobs;
  v_new_attempt_count integer;
begin
  select * into v_job from sync_jobs where id = p_job_id;
  if not found then
    raise exception 'sync_job % not found', p_job_id using errcode = 'P0002';
  end if;

  if p_success then
    update sync_jobs set status = 'SUCCESS', completed_at = now(), last_error = null
    where id = p_job_id
    returning * into v_job;

    insert into integration_logs (sync_job_id, organization_id, level, event, message)
    values (p_job_id, v_job.organization_id, 'INFO', 'job_succeeded', null);

    return v_job;
  end if;

  v_new_attempt_count := v_job.attempt_count + 1;

  if v_new_attempt_count >= v_job.max_attempts then
    update sync_jobs
    set status = 'FAILED_REQUIRES_ATTENTION', attempt_count = v_new_attempt_count,
        last_error = p_error, completed_at = now()
    where id = p_job_id
    returning * into v_job;

    insert into integration_logs (sync_job_id, organization_id, level, event, message)
    values (p_job_id, v_job.organization_id, 'ERROR', 'job_failed_requires_attention', p_error);
  else
    update sync_jobs
    set status = 'RETRY_SCHEDULED', attempt_count = v_new_attempt_count,
        last_error = p_error, next_retry_at = now() + retry_delay_for_attempt(v_new_attempt_count)
    where id = p_job_id
    returning * into v_job;

    insert into integration_logs (sync_job_id, organization_id, level, event, message)
    values (p_job_id, v_job.organization_id, 'WARN', 'job_retry_scheduled',
      p_error || ' (attempt ' || v_new_attempt_count || '/' || v_job.max_attempts || ')');
  end if;

  return v_job;
end;
$$;

revoke execute on function complete_sync_job(uuid, boolean, text) from public, authenticated, anon;

-- Section 77: "Find stuck PROCESSING jobs." If the worker process dies
-- mid-job (crash, timeout, cold-start eviction) after claim_next_sync_jobs
-- marked it PROCESSING but before complete_sync_job ever ran, the job would
-- otherwise sit PROCESSING forever — invisible to claim_next_sync_jobs
-- (which only looks at QUEUED/RETRY_SCHEDULED) and never retried. Called at
-- the start of every worker run, before claiming new work.
create or replace function reclaim_stuck_sync_jobs(p_stuck_after interval default '10 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_count integer := 0;
begin
  for v_job_id in
    select id from sync_jobs
    where status = 'PROCESSING' and locked_at < now() - p_stuck_after
  loop
    perform complete_sync_job(v_job_id, false, 'Reclaimed: stuck in PROCESSING past ' || p_stuck_after::text);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function reclaim_stuck_sync_jobs(interval) from public, authenticated, anon;
