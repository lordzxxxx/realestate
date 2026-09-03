-- Phase 8: verification escalation (sections 32, 37, 56 — the fuller
-- workflow Phase 5's stale-listing reminder was deliberately scoped to
-- precede, not replace)
--
-- last_verified_at is column-locked from direct client UPDATE (0013), same
-- as status/timestamps/version — it's only ever set automatically by
-- set_listing_status() on a transition into AVAILABLE/RESERVED (0014).
-- That's a side effect of an unrelated action, not a real "confirm still
-- available" affordance: an agent shouldn't have to toggle status away and
-- back just to reset the reminder clock. This is that affordance,
-- following the exact same pattern as assign_listing_agent() (0014):
-- permission-checked, single-purpose, touches only the one column it owns.

create or replace function verify_listing(p_listing_id uuid)
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

  if not listing_actor_has(v_listing, 'listing.update_own', array['listing.update_organization', 'listing.update_all']) then
    raise exception 'permission listing.update_own, listing.update_organization, or listing.update_all required' using errcode = '42501';
  end if;

  -- Deliberately does not bump `version` (listing_change_is_meaningful()
  -- doesn't list last_verified_at) — no new listing_revisions snapshot,
  -- and no fresh Sheets/Facebook sync job, for what is a "nothing changed,
  -- confirmed still true" action rather than a content edit.
  update listings set last_verified_at = now(), updated_by = auth.uid()
  where id = p_listing_id
  returning * into v_result;

  return v_result;
end;
$$;
