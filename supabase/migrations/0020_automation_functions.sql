-- Phase 5: event/job helper functions (sections 3, 4, 33, 37, 56)
--
-- IMPORTANT: Supabase auto-exposes every function with PUBLIC execute as a
-- callable RPC endpoint (`supabase.rpc('fn_name', {...})`) — and CREATE
-- FUNCTION grants EXECUTE to PUBLIC by default. These functions take
-- arbitrary user_id/organization_id/actor_id parameters with no internal
-- permission check (unlike set_listing_status() etc., which check
-- has_permission() internally and are meant to be called directly by
-- users). Called only from trigger functions (themselves SECURITY DEFINER,
-- so they run as the owning role regardless of who fired the trigger) —
-- never by an end user directly. Each is explicitly revoked from
-- authenticated/anon/public immediately below its definition so a
-- malicious session can't forge notifications or audit events via RPC.

create or replace function create_automation_event(
  p_organization_id uuid,
  p_event_type text,
  p_resource_type text,
  p_resource_id uuid,
  p_actor_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into automation_events (organization_id, event_type, resource_type, resource_id, actor_id, payload)
  values (p_organization_id, p_event_type, p_resource_type, p_resource_id, p_actor_id, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function create_automation_event(uuid, text, text, uuid, uuid, jsonb) from public, authenticated, anon;

create or replace function enqueue_sync_job(
  p_organization_id uuid,
  p_listing_id uuid,
  p_event_id uuid,
  p_job_type text,
  p_platform text,
  p_payload jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into sync_jobs (organization_id, listing_id, event_id, job_type, platform, payload, idempotency_key)
  values (p_organization_id, p_listing_id, p_event_id, p_job_type, p_platform, p_payload, p_idempotency_key)
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  return v_id; -- null means a job with this idempotency_key already existed
end;
$$;

revoke execute on function enqueue_sync_job(uuid, uuid, uuid, text, text, jsonb, text) from public, authenticated, anon;

-- Convenience wrapper: queues a SEND_NOTIFICATION job for one user. The
-- actual `notifications` row is created later, by the worker processing
-- this job (0022) — not here. That's the outbox pattern: this call is fast,
-- synchronous, and transactional with whatever triggered it; delivery is
-- async and independently retryable.
create or replace function enqueue_notification_job(
  p_user_id uuid,
  p_organization_id uuid,
  p_event_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_idempotency_suffix text
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select enqueue_sync_job(
    p_organization_id,
    null,
    p_event_id,
    'SEND_NOTIFICATION',
    'INTERNAL',
    jsonb_build_object(
      'user_id', p_user_id,
      'organization_id', p_organization_id,
      'type', p_type,
      'title', p_title,
      'body', p_body,
      'link', p_link
    ),
    'notify:' || p_idempotency_suffix || ':' || p_user_id::text
  );
$$;

revoke execute on function enqueue_notification_job(uuid, uuid, uuid, text, text, text, text, text) from public, authenticated, anon;

-- Section 37/56: notify every ACTIVE user who holds p_permission, globally
-- or scoped to p_organization_id (mirrors has_permission()'s own semantics:
-- a global grant matches any org, an org-scoped grant must match exactly).
create or replace function notify_users_with_permission(
  p_permission text,
  p_organization_id uuid,
  p_event_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_idempotency_suffix text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct p.id
    from profiles p
    join user_roles ur on ur.user_id = p.id
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions perm on perm.id = rp.permission_id
    where perm.key = p_permission
      and p.status = 'ACTIVE'
      and (ur.organization_id is null or ur.organization_id = p_organization_id)
  loop
    perform enqueue_notification_job(v_user_id, p_organization_id, p_event_id, p_type, p_title, p_body, p_link, p_idempotency_suffix);
  end loop;
end;
$$;

revoke execute on function notify_users_with_permission(text, uuid, uuid, text, text, text, text, text) from public, authenticated, anon;
