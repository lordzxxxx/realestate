-- Phase 4: Inquiries and viewing requests (sections 36-38)

create type preferred_contact_method as enum ('PHONE', 'EMAIL', 'MESSENGER');

create type inquiry_status as enum (
  'NEW', 'ASSIGNED', 'CONTACTED', 'VIEWING_SCHEDULED', 'FOLLOW_UP', 'CONVERTED', 'LOST', 'CLOSED'
);

create type viewing_status as enum ('REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED');

create table inquiries (
  id                        uuid primary key default gen_random_uuid(),
  listing_id                uuid not null references listings (id),
  organization_id           uuid not null references organizations (id), -- denormalized from listing at insert
  assigned_agent_id         uuid references profiles (id), -- auto-set from listing.assigned_agent_id (section 37)
  name                      text not null,
  phone                     text,
  email                     citext,
  message                   text,
  preferred_contact_method  preferred_contact_method,
  status                    inquiry_status not null default 'NEW',
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint inquiries_contact_method_present check (phone is not null or email is not null)
);

create index inquiries_listing_id_idx on inquiries (listing_id);
create index inquiries_organization_id_idx on inquiries (organization_id);
create index inquiries_assigned_agent_id_idx on inquiries (assigned_agent_id);
create index inquiries_status_idx on inquiries (status);

create trigger inquiries_set_updated_at
  before update on inquiries
  for each row
  execute function set_updated_at();

create table viewing_requests (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references listings (id),
  organization_id   uuid not null references organizations (id), -- denormalized from listing at insert
  assigned_agent_id uuid references profiles (id),
  name              text not null,
  phone             text,
  email             citext,
  preferred_date    date,
  preferred_time    text,
  notes             text,
  status            viewing_status not null default 'REQUESTED',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint viewing_requests_contact_method_present check (phone is not null or email is not null)
);

create index viewing_requests_listing_id_idx on viewing_requests (listing_id);
create index viewing_requests_organization_id_idx on viewing_requests (organization_id);
create index viewing_requests_assigned_agent_id_idx on viewing_requests (assigned_agent_id);
create index viewing_requests_status_idx on viewing_requests (status);

create trigger viewing_requests_set_updated_at
  before update on viewing_requests
  for each row
  execute function set_updated_at();

-- Auto-assignment (section 37): "If listing has an assigned agent, assign
-- inquiry automatically." Also fills in organization_id from the listing so
-- RLS never needs a join to figure out visibility scope.
create or replace function handle_new_inquiry()
returns trigger
language plpgsql
as $$
declare
  v_listing listings;
begin
  select * into v_listing from listings where id = new.listing_id;
  if not found then
    raise exception 'listing % not found', new.listing_id using errcode = 'P0002';
  end if;

  new.organization_id := v_listing.organization_id;

  if v_listing.assigned_agent_id is not null then
    new.assigned_agent_id := v_listing.assigned_agent_id;
    new.status := 'ASSIGNED';
  end if;

  return new;
end;
$$;

create trigger inquiries_before_insert
  before insert on inquiries
  for each row
  execute function handle_new_inquiry();

create or replace function handle_new_viewing_request()
returns trigger
language plpgsql
as $$
declare
  v_listing listings;
begin
  select * into v_listing from listings where id = new.listing_id;
  if not found then
    raise exception 'listing % not found', new.listing_id using errcode = 'P0002';
  end if;

  new.organization_id := v_listing.organization_id;

  if v_listing.assigned_agent_id is not null then
    new.assigned_agent_id := v_listing.assigned_agent_id;
  end if;

  return new;
end;
$$;

create trigger viewing_requests_before_insert
  before insert on viewing_requests
  for each row
  execute function handle_new_viewing_request();

-- RLS ---------------------------------------------------------------

alter table inquiries enable row level security;
alter table viewing_requests enable row level security;

-- Public visitors can create an inquiry/viewing request against any listing
-- that's actually publicly visible (section 36) — but never read them back;
-- there's no public "my inquiries" view in this system.
create policy inquiries_public_insert on inquiries
  for insert
  to public
  with check (
    exists (
      select 1 from listings l
      where l.id = inquiries.listing_id
        and is_publicly_visible(l.status, l.website_enabled)
    )
  );

create policy inquiries_select on inquiries
  for select
  to authenticated
  using (
    (assigned_agent_id = auth.uid() and has_permission(auth.uid(), 'inquiry.view_own', organization_id))
    or has_permission(auth.uid(), 'inquiry.view_organization', organization_id)
    or has_permission(auth.uid(), 'inquiry.view_all', organization_id)
  );

create policy inquiries_update on inquiries
  for update
  to authenticated
  using (
    has_permission(auth.uid(), 'inquiry.update', organization_id)
    or has_permission(auth.uid(), 'inquiry.assign', organization_id)
  )
  with check (
    has_permission(auth.uid(), 'inquiry.update', organization_id)
    or has_permission(auth.uid(), 'inquiry.assign', organization_id)
  );

-- organization_id/assigned_agent_id (initial) are trigger-controlled;
-- clients only ever change status/notes/reassignment through the update
-- policy above, which is row-scoped, not column-scoped — unlike
-- listings/profiles there is no separate approval workflow to bypass here,
-- so a plain table-level grant is sufficient (no column lockdown needed).

create policy viewing_requests_public_insert on viewing_requests
  for insert
  to public
  with check (
    exists (
      select 1 from listings l
      where l.id = viewing_requests.listing_id
        and is_publicly_visible(l.status, l.website_enabled)
    )
  );

create policy viewing_requests_select on viewing_requests
  for select
  to authenticated
  using (
    (assigned_agent_id = auth.uid() and has_permission(auth.uid(), 'viewing.view', organization_id))
    or has_permission(auth.uid(), 'viewing.manage', organization_id)
  );

create policy viewing_requests_update on viewing_requests
  for update
  to authenticated
  using (
    has_permission(auth.uid(), 'viewing.manage', organization_id)
    or has_permission(auth.uid(), 'viewing.assign', organization_id)
    or (assigned_agent_id = auth.uid() and has_permission(auth.uid(), 'viewing.view', organization_id))
  )
  with check (
    has_permission(auth.uid(), 'viewing.manage', organization_id)
    or has_permission(auth.uid(), 'viewing.assign', organization_id)
    or (assigned_agent_id = auth.uid() and has_permission(auth.uid(), 'viewing.view', organization_id))
  );
