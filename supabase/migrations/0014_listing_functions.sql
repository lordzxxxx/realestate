-- Phase 2: listing status transitions, agent assignment, revision tracking
-- (sections 14, 15, 22-24, 48, 49, 72, 73)

-- True if the caller may act on this listing under an "_own"-suffixed
-- permission (must be creator/assigned agent) or the corresponding
-- org/all-scoped permission (no ownership requirement).
create or replace function listing_actor_has(
  p_listing listings,
  p_own_permission text,
  p_broader_permissions text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_perm text;
begin
  if (p_listing.created_by = auth.uid() or p_listing.assigned_agent_id = auth.uid())
     and has_permission(auth.uid(), p_own_permission, p_listing.organization_id) then
    return true;
  end if;

  foreach v_perm in array p_broader_permissions loop
    if has_permission(auth.uid(), v_perm, p_listing.organization_id) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

-- The single place that changes listings.status. Validates the transition is
-- legal (section 72), checks the specific permission it requires, applies
-- the right automatic timestamp (section 69), and records history — all
-- inside one SECURITY DEFINER call so column privileges (0013) can force
-- every status change through here.
create or replace function set_listing_status(
  p_listing_id uuid,
  p_new_status listing_status,
  p_note text default null
)
returns listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing listings;
  v_allowed boolean := false;
  v_result listings;
begin
  select * into v_listing from listings where id = p_listing_id;
  if not found then
    raise exception 'listing % not found', p_listing_id using errcode = 'P0002';
  end if;

  v_allowed := case
    when v_listing.status = 'DRAFT' and p_new_status = 'PENDING_REVIEW' then
      listing_actor_has(v_listing, 'listing.update_own', array['listing.update_organization', 'listing.update_all'])
    when v_listing.status in ('DRAFT', 'CHANGES_REQUESTED') and p_new_status = 'AVAILABLE' then
      -- Mirrors the DRAFT->PENDING_REVIEW / CHANGES_REQUESTED->PENDING_REVIEW
      -- pair above: a trusted publisher resubmitting after requested changes
      -- also skips review, same as a fresh draft.
      listing_actor_has(v_listing, 'listing.publish_directly', array['listing.publish_directly'])
    when v_listing.status = 'CHANGES_REQUESTED' and p_new_status = 'PENDING_REVIEW' then
      listing_actor_has(v_listing, 'listing.update_own', array['listing.update_organization', 'listing.update_all'])
    when v_listing.status = 'PENDING_REVIEW' and p_new_status = 'APPROVED' then
      has_permission(auth.uid(), 'listing.approve', v_listing.organization_id)
    when v_listing.status = 'PENDING_REVIEW' and p_new_status = 'CHANGES_REQUESTED' then
      has_permission(auth.uid(), 'listing.reject', v_listing.organization_id)
    when v_listing.status = 'PENDING_REVIEW' and p_new_status = 'REJECTED' then
      has_permission(auth.uid(), 'listing.reject', v_listing.organization_id)
    when v_listing.status = 'APPROVED' and p_new_status = 'AVAILABLE' then
      has_permission(auth.uid(), 'listing.publish', v_listing.organization_id)
    when v_listing.status in ('AVAILABLE', 'RESERVED', 'TEMPORARILY_UNAVAILABLE')
         and p_new_status in ('AVAILABLE', 'RESERVED', 'RENTED', 'SOLD', 'TEMPORARILY_UNAVAILABLE')
         and v_listing.status != p_new_status then
      listing_actor_has(v_listing, 'listing.change_status', array['listing.change_status'])
    when p_new_status = 'ARCHIVED'
         and v_listing.status not in ('ARCHIVED') then
      listing_actor_has(v_listing, 'listing.archive_own', array['listing.archive_all'])
    else false
  end;

  if not v_allowed then
    raise exception 'transition % -> % is not permitted', v_listing.status, p_new_status using errcode = '42501';
  end if;

  update listings set
    status = p_new_status,
    submitted_at = case when p_new_status = 'PENDING_REVIEW' then now() else submitted_at end,
    approved_at = case when p_new_status in ('APPROVED', 'AVAILABLE') and approved_at is null then now() else approved_at end,
    published_at = case when p_new_status = 'AVAILABLE' and published_at is null then now() else published_at end,
    reserved_at = case when p_new_status = 'RESERVED' then now() else reserved_at end,
    rented_at = case when p_new_status = 'RENTED' then now() else rented_at end,
    sold_at = case when p_new_status = 'SOLD' then now() else sold_at end,
    archived_at = case when p_new_status = 'ARCHIVED' then now() else archived_at end,
    last_verified_at = case when p_new_status in ('AVAILABLE', 'RESERVED') then now() else last_verified_at end,
    updated_by = auth.uid()
  where id = p_listing_id
  returning * into v_result;

  insert into listing_status_history (listing_id, from_status, to_status, note, changed_by)
  values (p_listing_id, v_listing.status, p_new_status, p_note, auth.uid());

  return v_result;
end;
$$;

-- Convenience wrapper for the "Submit" button (section 15): trusted users
-- (listing.publish_directly) go straight to AVAILABLE, everyone else goes to
-- PENDING_REVIEW. This is the single business action described in section 73
-- ("APPROVE & PUBLISH is a single action") mirrored on the submission side.
create or replace function submit_listing(p_listing_id uuid)
returns listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing listings;
begin
  select * into v_listing from listings where id = p_listing_id;
  if not found then
    raise exception 'listing % not found', p_listing_id using errcode = 'P0002';
  end if;

  if listing_actor_has(v_listing, 'listing.publish_directly', array['listing.publish_directly']) then
    return set_listing_status(p_listing_id, 'AVAILABLE', 'Published directly (trusted publisher)');
  else
    return set_listing_status(p_listing_id, 'PENDING_REVIEW', null);
  end if;
end;
$$;

-- Section 73: a privileged reviewer approving a pending listing publishes it
-- in one action, rather than separate "Approve" then "Publish" clicks.
create or replace function approve_and_publish_listing(p_listing_id uuid, p_note text default null)
returns listings
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_listing_status(p_listing_id, 'APPROVED', p_note);
  return set_listing_status(p_listing_id, 'AVAILABLE', null);
end;
$$;

-- Section 15/37: assigning an agent is a distinct, gated action.
create or replace function assign_listing_agent(p_listing_id uuid, p_agent_id uuid)
returns listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing listings;
  v_result listings;
begin
  select * into v_listing from listings where id = p_listing_id;
  if not found then
    raise exception 'listing % not found', p_listing_id using errcode = 'P0002';
  end if;

  if not has_permission(auth.uid(), 'listing.assign_agent', v_listing.organization_id) then
    raise exception 'permission listing.assign_agent required' using errcode = '42501';
  end if;

  if p_agent_id is not null and not exists (
    select 1 from profiles where id = p_agent_id and organization_id is not distinct from v_listing.organization_id
  ) then
    raise exception 'agent % is not a member of this listing''s organization', p_agent_id using errcode = '23514';
  end if;

  update listings set assigned_agent_id = p_agent_id, updated_by = auth.uid()
  where id = p_listing_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke update (assigned_agent_id) on listings from authenticated, anon;

-- Revisions (sections 48, 49): snapshot + version bump whenever a field that
-- matters to downstream sync jobs actually changes.
--
-- Split into a BEFORE trigger (bumps NEW.version so the bump persists to the
-- row) and an AFTER trigger (inserts the snapshot). They can't be combined:
-- a BEFORE trigger can mutate NEW, but the row doesn't exist in `listings`
-- yet at that point, so a child-table INSERT into listing_revisions would
-- fail its foreign key; an AFTER trigger sees the row post-write but can no
-- longer mutate NEW to persist a version bump. Both recompute the same
-- "meaningful change" predicate independently, via a shared helper.
create or replace function listing_change_is_meaningful(p_old listings, p_new listings, p_is_insert boolean)
returns boolean
language sql
immutable
as $$
  select p_is_insert or (
    p_new.status is distinct from p_old.status or
    p_new.monthly_rent is distinct from p_old.monthly_rent or
    p_new.selling_price is distinct from p_old.selling_price or
    p_new.association_dues is distinct from p_old.association_dues or
    p_new.security_deposit is distinct from p_old.security_deposit or
    p_new.is_negotiable is distinct from p_old.is_negotiable or
    p_new.title is distinct from p_old.title or
    p_new.description is distinct from p_old.description or
    p_new.bedrooms is distinct from p_old.bedrooms or
    p_new.bathrooms is distinct from p_old.bathrooms or
    p_new.furnishing is distinct from p_old.furnishing or
    p_new.floor_area is distinct from p_old.floor_area or
    p_new.lot_area is distinct from p_old.lot_area or
    p_new.assigned_agent_id is distinct from p_old.assigned_agent_id
  );
$$;

create or replace function bump_listing_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and listing_change_is_meaningful(old, new, false) then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

create trigger listings_before_bump_version
  before update on listings
  for each row
  execute function bump_listing_version();

-- SECURITY DEFINER because authenticated has no direct grant on
-- listing_revisions (0013) — this function is the only writer.
create or replace function record_listing_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not listing_change_is_meaningful(old, new, tg_op = 'INSERT') then
    return new;
  end if;

  insert into listing_revisions (listing_id, version, snapshot, changed_by)
  values (new.id, new.version, to_jsonb(new), auth.uid())
  on conflict (listing_id, version) do nothing;

  return new;
end;
$$;

create trigger listings_after_record_revision
  after insert or update on listings
  for each row
  execute function record_listing_revision();

revoke update (version) on listings from authenticated, anon;
