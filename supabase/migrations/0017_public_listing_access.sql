-- Phase 4: Public marketplace read access (sections 34-35, 64).
--
-- Every listings-domain RLS policy so far is `to authenticated` — an
-- anonymous visitor currently gets zero rows from any of these tables.
-- These policies add public (anon + authenticated) read access, scoped to
-- listings that were ever actually published and haven't been withdrawn.
--
-- "Publicly visible" deliberately includes RESERVED/RENTED/SOLD/
-- TEMPORARILY_UNAVAILABLE, not just AVAILABLE: section 23/24 want a rented
-- or sold unit's page to stay reachable (marked as such, not as available),
-- and section 74's per-listing website_enabled toggle is management's
-- actual kill switch for "keep this off the public site" — separate from
-- status entirely.
--
-- listing_contacts (private owner/key-holder/representative info) is
-- deliberately untouched here — it stays authenticated-only, gated by the
-- ownership/permission rule from migration 0013.

create or replace function is_publicly_visible(p_status listing_status, p_website_enabled boolean)
returns boolean
language sql
immutable
as $$
  select p_website_enabled
    and p_status in ('AVAILABLE', 'RESERVED', 'RENTED', 'SOLD', 'TEMPORARILY_UNAVAILABLE');
$$;

create policy listings_public_select on listings
  for select
  to public
  using (is_publicly_visible(status, website_enabled));

create policy listing_images_public_select on listing_images
  for select
  to public
  using (
    exists (
      select 1 from listings l
      where l.id = listing_images.listing_id
        and is_publicly_visible(l.status, l.website_enabled)
    )
  );

create policy listing_amenities_public_select on listing_amenities
  for select
  to public
  using (
    exists (
      select 1 from listings l
      where l.id = listing_amenities.listing_id
        and is_publicly_visible(l.status, l.website_enabled)
    )
  );

-- The amenities master list itself (labels like "Pool", "Mall") is not
-- sensitive reference data — the existing amenities_select policy (0013) is
-- `to authenticated` only, which would otherwise leave a public visitor
-- unable to render amenity names even though listing_amenities is visible.
create policy amenities_public_select on amenities
  for select
  to public
  using (true);
