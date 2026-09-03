-- Phase 7: Facebook Page sync dispatch (sections 25-28, 52, 58)
--
-- Same outbox pattern as Phase 5/6. Unlike Google Sheets (which tracks
-- every listing regardless of visibility, since it's an internal master
-- directory), Facebook posting is public marketing — it must only ever
-- fire for a listing that's actually publicly visible right now, reusing
-- the exact predicate the public site itself uses (is_publicly_visible(),
-- migration 0017) so "would this show on the website" and "should this be
-- on Facebook" can never silently disagree.

create or replace function listings_emit_facebook_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_sync_enabled boolean;
  v_connection record;
  v_event_id uuid;
begin
  if not (new.facebook_enabled and new.auto_sync_enabled and is_publicly_visible(new.status, new.website_enabled)) then
    return new;
  end if;

  select auto_publish_facebook into v_org_sync_enabled
  from organization_settings
  where organization_id = new.organization_id;

  if v_org_sync_enabled is distinct from true then
    return new;
  end if;

  select page_id, status into v_connection
  from facebook_page_connections
  where organization_id = new.organization_id;

  if v_connection is null or v_connection.status is distinct from 'CONNECTED' or v_connection.page_id is null then
    return new;
  end if;

  v_event_id := create_automation_event(new.organization_id, 'LISTING_FACEBOOK_SYNC_REQUESTED', 'listing', new.id, new.updated_by,
    jsonb_build_object('property_name', new.property_name));

  -- Keyed on new.version, same convention as 0021/0024: a trivial re-save
  -- while still publicly visible still queues a fresh sync (edits the
  -- existing post's message — see the worker), matching "keep the public
  -- post in sync with the listing" the same way Sheets keeps its row in
  -- sync. The worker's own post-id lookup (facebook_post_records), not
  -- this key, is what prevents duplicate *posts* — this key only
  -- deduplicates the *job*.
  perform enqueue_sync_job(
    new.organization_id,
    new.id,
    v_event_id,
    'FACEBOOK_UPSERT_POST',
    'FACEBOOK',
    jsonb_build_object(
      'page_id', v_connection.page_id,
      'listing_id', new.id,
      'listing_number', new.listing_number,
      'status', new.status,
      'listing_type', new.listing_type,
      'property_name', new.property_name,
      'bedrooms', new.bedrooms,
      'bathrooms', new.bathrooms,
      'monthly_rent', new.monthly_rent,
      'selling_price', new.selling_price,
      'city', new.city,
      'province', new.province,
      'slug', new.slug
    ),
    'facebook_upsert:' || new.id || ':' || new.version
  );

  return new;
end;
$$;

create trigger listings_after_emit_facebook_sync
  after insert or update on listings
  for each row
  execute function listings_emit_facebook_sync();

-- Generic "retry a dead-lettered job" (section 32/77, and literally what
-- integrations.retry's own description in 0007 promises: "Manually retry a
-- failed sync job"). Not Facebook-specific — this closes a gap that
-- existed since Phase 5 too (there was previously no way to retry a
-- FAILED_REQUIRES_ATTENTION job at all short of Phase 6's blanket
-- reconcile_google_sheets(), which force-requeues *everything*). Permission-
-- checked internally, like reconcile_google_sheets(), since it's meant to
-- be called directly.
create or replace function retry_sync_job(p_job_id uuid)
returns sync_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job sync_jobs;
begin
  select * into v_job from sync_jobs where id = p_job_id;
  if not found then
    raise exception 'sync_job % not found', p_job_id using errcode = 'P0002';
  end if;

  if not (has_permission(auth.uid(), 'integrations.retry', v_job.organization_id)
          or has_permission(auth.uid(), 'integrations.manage', v_job.organization_id)) then
    raise exception 'permission integrations.retry or integrations.manage required' using errcode = '42501';
  end if;

  if v_job.status is distinct from 'FAILED_REQUIRES_ATTENTION' then
    raise exception 'sync_job % is not dead-lettered (currently %) — nothing to retry', p_job_id, v_job.status using errcode = '42501';
  end if;

  update sync_jobs
  set status = 'QUEUED', attempt_count = 0, next_retry_at = null, last_error = null, locked_at = null, completed_at = null
  where id = p_job_id
  returning * into v_job;

  insert into integration_logs (sync_job_id, organization_id, level, event, message)
  values (p_job_id, v_job.organization_id, 'INFO', 'job_manually_retried', 'Manually retried by ' || coalesce(auth.uid()::text, 'unknown'));

  return v_job;
end;
$$;
