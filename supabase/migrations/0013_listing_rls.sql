-- Phase 2: RLS for the listings domain

alter table listings enable row level security;
alter table listing_images enable row level security;
alter table listing_contacts enable row level security;
alter table amenities enable row level security;
alter table listing_amenities enable row level security;
alter table listing_status_history enable row level security;
alter table listing_revisions enable row level security;

-- LISTINGS ------------------------------------------------------------

create policy listings_select on listings
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or assigned_agent_id = auth.uid()
    or has_permission(auth.uid(), 'listing.read_organization', organization_id)
    or has_permission(auth.uid(), 'listing.read_all', organization_id)
  );

create policy listings_insert on listings
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and has_permission(auth.uid(), 'listing.create', organization_id)
  );

create policy listings_update on listings
  for update
  to authenticated
  using (
    (created_by = auth.uid() and has_permission(auth.uid(), 'listing.update_own', organization_id))
    or has_permission(auth.uid(), 'listing.update_organization', organization_id)
    or has_permission(auth.uid(), 'listing.update_all', organization_id)
  )
  with check (
    (created_by = auth.uid() and has_permission(auth.uid(), 'listing.update_own', organization_id))
    or has_permission(auth.uid(), 'listing.update_organization', organization_id)
    or has_permission(auth.uid(), 'listing.update_all', organization_id)
  );

-- No delete policy: listings are archived (status = ARCHIVED), never deleted
-- (section 14: "Do not permanently delete rented/sold properties automatically").

-- Column-level lockdown, same pattern and rationale as profiles (0009):
-- RLS authorizes ROWS, so anyone who can update_own could otherwise PATCH
-- status/approval timestamps/version directly, bypassing set_listing_status()
-- and the revision trigger's race protection. Those columns are only ever
-- writable by SECURITY DEFINER functions owned by the migration role.
revoke update on listings from authenticated, anon;
grant update (
  listing_type, property_type,
  property_name, title, description,
  bedrooms, bathrooms, has_balcony, tower, building, floor, unit_number,
  floor_area, lot_area, furnishing, has_parking, parking_slots,
  monthly_rent, selling_price, association_dues, security_deposit, advance,
  payment_terms, is_negotiable,
  country, province, city, barangay, full_address, latitude, longitude,
  website_enabled, facebook_enabled, google_sheets_enabled, auto_sync_enabled,
  seo_title, seo_description,
  updated_by
) on listings to authenticated;

-- LISTING_IMAGES --------------------------------------------------------

create policy listing_images_select on listing_images
  for select
  to authenticated
  using (exists (select 1 from listings l where l.id = listing_images.listing_id));

create policy listing_images_manage on listing_images
  for all
  to authenticated
  using (
    exists (
      select 1 from listings l
      where l.id = listing_images.listing_id
        and has_permission(auth.uid(), 'listing.manage_images', l.organization_id)
        and (
          l.created_by = auth.uid()
          or l.assigned_agent_id = auth.uid()
          or has_permission(auth.uid(), 'listing.update_organization', l.organization_id)
          or has_permission(auth.uid(), 'listing.update_all', l.organization_id)
        )
    )
  )
  with check (
    exists (
      select 1 from listings l
      where l.id = listing_images.listing_id
        and has_permission(auth.uid(), 'listing.manage_images', l.organization_id)
        and (
          l.created_by = auth.uid()
          or l.assigned_agent_id = auth.uid()
          or has_permission(auth.uid(), 'listing.update_organization', l.organization_id)
          or has_permission(auth.uid(), 'listing.update_all', l.organization_id)
        )
    )
  );

-- LISTING_CONTACTS (private) --------------------------------------------
-- Deliberately broader than listing.view_private_contacts alone: whoever
-- created/is assigned to the listing entered this data and must be able to
-- manage it, even without the org-wide oversight permission (section 2).

create policy listing_contacts_select on listing_contacts
  for select
  to authenticated
  using (
    exists (
      select 1 from listings l
      where l.id = listing_contacts.listing_id
        and (
          l.created_by = auth.uid()
          or l.assigned_agent_id = auth.uid()
          or has_permission(auth.uid(), 'listing.view_private_contacts', l.organization_id)
        )
    )
  );

create policy listing_contacts_manage on listing_contacts
  for all
  to authenticated
  using (
    exists (
      select 1 from listings l
      where l.id = listing_contacts.listing_id
        and (
          l.created_by = auth.uid()
          or l.assigned_agent_id = auth.uid()
          or has_permission(auth.uid(), 'listing.view_private_contacts', l.organization_id)
        )
    )
  )
  with check (
    exists (
      select 1 from listings l
      where l.id = listing_contacts.listing_id
        and (
          l.created_by = auth.uid()
          or l.assigned_agent_id = auth.uid()
          or has_permission(auth.uid(), 'listing.view_private_contacts', l.organization_id)
        )
    )
  );

-- AMENITIES (shared reference data) --------------------------------------

create policy amenities_select on amenities
  for select
  to authenticated
  using (true);

create policy amenities_insert_custom on amenities
  for insert
  to authenticated
  with check (is_system = false);

create policy listing_amenities_select on listing_amenities
  for select
  to authenticated
  using (exists (select 1 from listings l where l.id = listing_amenities.listing_id));

create policy listing_amenities_manage on listing_amenities
  for all
  to authenticated
  using (
    exists (
      select 1 from listings l
      where l.id = listing_amenities.listing_id
        and (
          (l.created_by = auth.uid() and has_permission(auth.uid(), 'listing.update_own', l.organization_id))
          or has_permission(auth.uid(), 'listing.update_organization', l.organization_id)
          or has_permission(auth.uid(), 'listing.update_all', l.organization_id)
        )
    )
  )
  with check (
    exists (
      select 1 from listings l
      where l.id = listing_amenities.listing_id
        and (
          (l.created_by = auth.uid() and has_permission(auth.uid(), 'listing.update_own', l.organization_id))
          or has_permission(auth.uid(), 'listing.update_organization', l.organization_id)
          or has_permission(auth.uid(), 'listing.update_all', l.organization_id)
        )
    )
  );

-- LISTING_STATUS_HISTORY / LISTING_REVISIONS (read-only to clients) ------
-- Both are written exclusively by SECURITY DEFINER functions (0014); no
-- insert/update/delete grant exists for authenticated/anon at all.

create policy listing_status_history_select on listing_status_history
  for select
  to authenticated
  using (exists (select 1 from listings l where l.id = listing_status_history.listing_id));

create policy listing_revisions_select on listing_revisions
  for select
  to authenticated
  using (exists (select 1 from listings l where l.id = listing_revisions.listing_id));

revoke insert, update, delete on listing_status_history from authenticated, anon;
revoke insert, update, delete on listing_revisions from authenticated, anon;
