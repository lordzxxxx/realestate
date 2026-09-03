-- Phase 5: Automation engine schema (sections 3, 4, 30-33, 56, 58)
--
-- Outbox pattern: a DB transaction that changes something meaningful writes
-- automation_events + sync_jobs in the SAME transaction (via triggers, so it
-- can never be "forgotten" by application code) and returns immediately.
-- A separate worker (0022) claims and processes sync_jobs asynchronously.
--
-- event_type/job_type are plain text, not enums: this list will keep growing
-- through Phases 6-9 (FACEBOOK_CREATE_POST, SHEETS_UPDATE_ROW, ...) and a
-- text column avoids a migration every time. job status IS an enum — that's
-- queue-state machinery this phase fully owns and controls.

create type sync_job_status as enum (
  'QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED', 'RETRY_SCHEDULED', 'CANCELLED', 'FAILED_REQUIRES_ATTENTION'
);

create table automation_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id),
  event_type      text not null,
  resource_type   text not null,
  resource_id     uuid,
  actor_id        uuid references profiles (id), -- null for system/cron-originated events
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index automation_events_organization_id_idx on automation_events (organization_id);
create index automation_events_resource_idx on automation_events (resource_type, resource_id);
create index automation_events_event_type_idx on automation_events (event_type);

create table sync_jobs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id),
  listing_id      uuid references listings (id),
  event_id        uuid references automation_events (id),
  job_type        text not null,
  platform        text not null default 'INTERNAL', -- 'INTERNAL' today; 'FACEBOOK'/'GOOGLE_SHEETS' in later phases
  payload         jsonb not null default '{}'::jsonb,
  status          sync_job_status not null default 'QUEUED',
  priority        integer not null default 100,
  attempt_count   integer not null default 0,
  max_attempts    integer not null default 4,
  next_retry_at   timestamptz,
  -- Deterministic per job (e.g. 'notify:<event_id>:<user_id>') so a trigger
  -- firing twice, or the worker retrying an insert, can never create two
  -- jobs (or two side effects) for the same logical action (section 33).
  idempotency_key text not null unique,
  last_error      text,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  locked_at       timestamptz
);

create index sync_jobs_status_next_retry_idx on sync_jobs (status, next_retry_at);
create index sync_jobs_organization_id_idx on sync_jobs (organization_id);
create index sync_jobs_listing_id_idx on sync_jobs (listing_id);
create index sync_jobs_event_id_idx on sync_jobs (event_id);

-- Section 78: never store sensitive tokens/secrets in these rows. Not yet a
-- live concern (no external credentials exist until Phase 6/7), but the
-- constraint holds going forward regardless of what job types get added.
create table integration_logs (
  id              uuid primary key default gen_random_uuid(),
  sync_job_id     uuid references sync_jobs (id),
  organization_id uuid references organizations (id),
  level           text not null default 'INFO', -- INFO, WARN, ERROR
  event           text not null, -- e.g. 'job_started', 'job_succeeded', 'job_failed', 'job_retry_scheduled'
  message         text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index integration_logs_sync_job_id_idx on integration_logs (sync_job_id);
create index integration_logs_organization_id_idx on integration_logs (organization_id);

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles (id),
  organization_id uuid references organizations (id),
  type            text not null,
  title           text not null,
  body            text,
  link            text, -- relative in-app path, e.g. /listings/<id>
  -- Traceability (which job created this) AND a safety net: if the worker
  -- ever processes the same SEND_NOTIFICATION job twice (e.g. it crashes
  -- after inserting this row but before calling complete_sync_job), a
  -- second insert for the same job fails/no-ops instead of double-sending.
  -- A plain UNIQUE constraint still allows any number of NULLs, so this
  -- doesn't force every notification to originate from a job.
  sync_job_id     uuid references sync_jobs (id) unique,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index notifications_user_id_idx on notifications (user_id, created_at desc);
create index notifications_unread_idx on notifications (user_id) where read_at is null;

-- RLS ------------------------------------------------------------------

alter table automation_events enable row level security;
alter table sync_jobs enable row level security;
alter table integration_logs enable row level security;
alter table notifications enable row level security;

-- automation_events/sync_jobs/integration_logs: staff-viewable (Phase 9
-- builds the Automation Center UI on top of this) but never writable by an
-- authenticated session directly — only SECURITY DEFINER functions (0020)
-- and the service-role worker (0022) write them. No insert/update/delete
-- grant exists for authenticated/anon on any of the three.

create policy automation_events_select on automation_events
  for select
  to authenticated
  using (has_permission(auth.uid(), 'audit.view', organization_id));

create policy sync_jobs_select on sync_jobs
  for select
  to authenticated
  using (has_permission(auth.uid(), 'integrations.view', organization_id));

create policy integration_logs_select on integration_logs
  for select
  to authenticated
  using (has_permission(auth.uid(), 'integrations.view', organization_id));

revoke insert, update, delete on automation_events from authenticated, anon;
revoke insert, update, delete on sync_jobs from authenticated, anon;
revoke insert, update, delete on integration_logs from authenticated, anon;

-- notifications: a user sees and can mark-read only their own. Never
-- created by a client directly — only by notify_user()/notify_users_with_permission()
-- (SECURITY DEFINER, 0020) and the worker (service role).

create policy notifications_select on notifications
  for select
  to authenticated
  using (user_id = auth.uid());

create policy notifications_update on notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke insert, delete on notifications from authenticated, anon;
-- Only read_at is meant to be client-settable (marking a notification read).
revoke update on notifications from authenticated, anon;
grant update (read_at) on notifications to authenticated;
