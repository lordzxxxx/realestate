-- Phase 5: event-emitting triggers (sections 2, 15, 21-24, 37, 56, 73)
--
-- These fire regardless of which code path made the change — a server
-- action, the bootstrap script, or a future admin tool — because they live
-- in the database, not in application code that could forget to call them.
--
-- All are SECURITY DEFINER: a trigger fired by an ordinary authenticated
-- user's UPDATE runs as that role by default, and enqueue_notification_job()/
-- notify_users_with_permission() explicitly revoke EXECUTE from
-- authenticated/anon (0020) — without SECURITY DEFINER here, a normal
-- user's own listing update would fail with "permission denied for
-- function enqueue_notification_job".

create or replace function listings_emit_automation_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_recipient uuid;
begin
  if tg_op = 'INSERT' then
    perform create_automation_event(new.organization_id, 'LISTING_CREATED', 'listing', new.id, new.created_by, '{}'::jsonb);
    return new;
  end if;

  -- Status transitions -----------------------------------------------
  if new.status is distinct from old.status then
    if old.status in ('DRAFT', 'CHANGES_REQUESTED') and new.status = 'PENDING_REVIEW' then
      v_event_id := create_automation_event(new.organization_id, 'LISTING_SUBMITTED', 'listing', new.id, new.updated_by,
        jsonb_build_object('property_name', new.property_name));
      perform notify_users_with_permission('listing.approve', new.organization_id, v_event_id,
        'LISTING_SUBMITTED', 'New listing submitted for review',
        new.property_name || ' (' || new.listing_number || ')', '/listings/' || new.id,
        'listing_submitted:' || new.id || ':' || new.version);

    elsif new.status = 'AVAILABLE' and old.status != 'AVAILABLE' then
      v_event_id := create_automation_event(new.organization_id, 'LISTING_PUBLISHED', 'listing', new.id, new.updated_by,
        jsonb_build_object('property_name', new.property_name));
      for v_recipient in select distinct id from unnest(array[new.created_by, new.assigned_agent_id]) as id where id is not null loop
        perform enqueue_notification_job(v_recipient, new.organization_id, v_event_id, 'LISTING_PUBLISHED',
          'Listing published', new.property_name || ' is now live on the website.', '/listings/' || new.id,
          'listing_published:' || new.id || ':' || new.version);
      end loop;

    elsif new.status = 'CHANGES_REQUESTED' then
      v_event_id := create_automation_event(new.organization_id, 'LISTING_CHANGES_REQUESTED', 'listing', new.id, new.updated_by,
        jsonb_build_object('property_name', new.property_name));
      if new.created_by is not null then
        perform enqueue_notification_job(new.created_by, new.organization_id, v_event_id, 'LISTING_CHANGES_REQUESTED',
          'Changes requested', 'Management requested changes on ' || new.property_name || '.', '/listings/' || new.id,
          'listing_changes_requested:' || new.id || ':' || new.version);
      end if;

    elsif new.status = 'REJECTED' then
      v_event_id := create_automation_event(new.organization_id, 'LISTING_REJECTED', 'listing', new.id, new.updated_by,
        jsonb_build_object('property_name', new.property_name));
      if new.created_by is not null then
        perform enqueue_notification_job(new.created_by, new.organization_id, v_event_id, 'LISTING_REJECTED',
          'Listing rejected', new.property_name || ' was not approved.', '/listings/' || new.id,
          'listing_rejected:' || new.id || ':' || new.version);
      end if;

    elsif new.status in ('RESERVED', 'RENTED', 'SOLD') then
      v_event_id := create_automation_event(new.organization_id, 'LISTING_' || new.status::text, 'listing', new.id, new.updated_by,
        jsonb_build_object('property_name', new.property_name));
      perform notify_users_with_permission('listing.approve', new.organization_id, v_event_id,
        'LISTING_' || new.status::text, initcap(new.status::text) || ': ' || new.property_name,
        new.listing_number, '/listings/' || new.id,
        'listing_' || lower(new.status::text) || ':' || new.id || ':' || new.version);
    end if;
  end if;

  -- Price change on an already-published listing (section 21) ---------
  if (new.monthly_rent is distinct from old.monthly_rent or new.selling_price is distinct from old.selling_price)
     and old.published_at is not null then
    v_event_id := create_automation_event(new.organization_id, 'LISTING_PRICE_CHANGED', 'listing', new.id, new.updated_by,
      jsonb_build_object('property_name', new.property_name, 'monthly_rent', new.monthly_rent, 'selling_price', new.selling_price));
    perform notify_users_with_permission('listing.approve', new.organization_id, v_event_id,
      'LISTING_PRICE_CHANGED', 'Price changed: ' || new.property_name,
      new.listing_number, '/listings/' || new.id,
      'listing_price_changed:' || new.id || ':' || new.version);
  end if;

  -- Agent (re)assignment ------------------------------------------------
  if new.assigned_agent_id is distinct from old.assigned_agent_id and new.assigned_agent_id is not null then
    v_event_id := create_automation_event(new.organization_id, 'LISTING_AGENT_ASSIGNED', 'listing', new.id, new.updated_by,
      jsonb_build_object('property_name', new.property_name));
    perform enqueue_notification_job(new.assigned_agent_id, new.organization_id, v_event_id, 'LISTING_AGENT_ASSIGNED',
      'You were assigned a listing', new.property_name || ' (' || new.listing_number || ')', '/listings/' || new.id,
      'listing_agent_assigned:' || new.id || ':' || new.version);
  end if;

  return new;
end;
$$;

create trigger listings_after_emit_events
  after insert or update on listings
  for each row
  execute function listings_emit_automation_events();

-- PROFILES --------------------------------------------------------------

create or replace function profiles_emit_automation_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if tg_op = 'INSERT' then
    v_event_id := create_automation_event(new.organization_id, 'USER_REGISTERED', 'profile', new.id, new.id,
      jsonb_build_object('full_name', new.full_name, 'user_category', new.user_category));
    -- organization_id may be null for a fresh external registrant (section
    -- 9) — notify_users_with_permission's null-scope semantics then match
    -- only globally-granted roles, which is exactly who should be reviewing
    -- registrants with no organization yet (see README's scoping note).
    perform notify_users_with_permission('user.approve', new.organization_id, v_event_id,
      'USER_REGISTERED', 'New registration: ' || new.full_name,
      new.user_category::text || coalesce(' · ' || new.organization_name, ''), '/admin/approvals',
      'user_registered:' || new.id);
    return new;
  end if;

  if new.status = 'ACTIVE' and old.status = 'PENDING' then
    v_event_id := create_automation_event(new.organization_id, 'USER_APPROVED', 'profile', new.id, new.approved_by,
      jsonb_build_object('full_name', new.full_name));
    perform enqueue_notification_job(new.id, new.organization_id, v_event_id, 'USER_APPROVED',
      'Your account has been approved', 'You can now sign in and start using the system.', '/dashboard',
      'user_approved:' || new.id);
  end if;

  return new;
end;
$$;

create trigger profiles_after_emit_events
  after insert or update on profiles
  for each row
  execute function profiles_emit_automation_events();

-- INQUIRIES ---------------------------------------------------------------

create or replace function inquiries_emit_automation_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_listing_label text;
begin
  select property_name || ' (' || listing_number || ')' into v_listing_label from listings where id = new.listing_id;

  v_event_id := create_automation_event(new.organization_id, 'INQUIRY_CREATED', 'inquiry', new.id, null,
    jsonb_build_object('name', new.name, 'listing_id', new.listing_id));

  if new.assigned_agent_id is not null then
    perform enqueue_notification_job(new.assigned_agent_id, new.organization_id, v_event_id, 'INQUIRY_CREATED',
      'New inquiry: ' || v_listing_label, new.name || ' is interested in this property.', '/inquiries',
      'inquiry_created:' || new.id);
  else
    perform notify_users_with_permission('inquiry.view_organization', new.organization_id, v_event_id,
      'INQUIRY_CREATED', 'New inquiry: ' || v_listing_label,
      new.name || ' is interested in this property (unassigned).', '/inquiries',
      'inquiry_created:' || new.id);
  end if;

  return new;
end;
$$;

create trigger inquiries_after_emit_events
  after insert on inquiries
  for each row
  execute function inquiries_emit_automation_events();

-- VIEWING_REQUESTS --------------------------------------------------------

create or replace function viewing_requests_emit_automation_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_listing_label text;
begin
  select property_name || ' (' || listing_number || ')' into v_listing_label from listings where id = new.listing_id;

  v_event_id := create_automation_event(new.organization_id, 'VIEWING_REQUESTED', 'viewing_request', new.id, null,
    jsonb_build_object('name', new.name, 'listing_id', new.listing_id));

  if new.assigned_agent_id is not null then
    perform enqueue_notification_job(new.assigned_agent_id, new.organization_id, v_event_id, 'VIEWING_REQUESTED',
      'Viewing requested: ' || v_listing_label, new.name || ' would like to view this property.', '/viewings',
      'viewing_requested:' || new.id);
  else
    perform notify_users_with_permission('viewing.manage', new.organization_id, v_event_id,
      'VIEWING_REQUESTED', 'Viewing requested: ' || v_listing_label,
      new.name || ' would like to view this property (unassigned).', '/viewings',
      'viewing_requested:' || new.id);
  end if;

  return new;
end;
$$;

create trigger viewing_requests_after_emit_events
  after insert on viewing_requests
  for each row
  execute function viewing_requests_emit_automation_events();
