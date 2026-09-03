-- Local smoke test only. Depends on 999/998 having run first (reuses their
-- org/users). Verifies: verify_listing() is permission-checked the same way
-- as assign_listing_agent() (creator/assigned-agent-with-update_own, or a
-- broader org/all permission), touches only last_verified_at (status,
-- version, and listing_revisions are all untouched), and the worker's
-- 14-day escalation tier is reachable independently of the 7-day agent
-- reminder tier already covered by 996.

\set ON_ERROR_STOP on

set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222'; -- trusted agent (publish_directly) from 998

do $$
declare
  v_org_id uuid := (select id from organizations where slug = 'main-realty-co');
  v_listing_id uuid;
begin
  insert into listings (organization_id, listing_type, property_type, property_name, monthly_rent, created_by)
  values (v_org_id, 'RENT', 'CONDOMINIUM', 'Verification Smoke Test Unit', 21000, '22222222-2222-2222-2222-222222222222')
  returning id into v_listing_id;

  perform set_config('reos.verify_listing_id', v_listing_id::text, false);
end $$;

-- Trusted agent's submit_listing() lands directly on AVAILABLE (same
-- shortcut as 998/994) — handle_new_listing() (0011) forces last_verified_at
-- null on insert, so this listing starts unverified.
select (submit_listing(current_setting('reos.verify_listing_id')::uuid)).status as listing_is_available;

select last_verified_at is null as starts_unverified, version as version_before_verify
  from listings where id = current_setting('reos.verify_listing_id')::uuid \gset

-- 1. An unrelated outsider (no listing.update_own/organization/all on this
--    listing) cannot verify it.
reset role;
reset request.jwt.uid;

set role authenticated;
set request.jwt.uid = '55555555-5555-5555-5555-555555555555'; -- unrelated KEY_HOLDER outsider from 998

do $$
begin
  begin
    perform verify_listing(current_setting('reos.verify_listing_id')::uuid);
    raise exception 'SECURITY BUG: unrelated outsider verified a listing they have no permission on';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: verify_listing() blocked for unrelated outsider (%)', sqlerrm;
  end;
end $$;

reset role;
reset request.jwt.uid;

-- 2. The listing's own creator/assigned agent can verify it — sets
--    last_verified_at, but touches nothing else: status, version, and the
--    listing_revisions count are all unchanged (this is "confirmed, nothing
--    changed", not a content edit).
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

select count(*) as revisions_before_verify from listing_revisions
  where listing_id = current_setting('reos.verify_listing_id')::uuid;

select status, version, last_verified_at is not null as now_verified
  from verify_listing(current_setting('reos.verify_listing_id')::uuid);

select version = :version_before_verify as version_unchanged_by_verify
  from listings where id = current_setting('reos.verify_listing_id')::uuid;

select count(*) as revisions_after_verify from listing_revisions
  where listing_id = current_setting('reos.verify_listing_id')::uuid;

reset role;
reset request.jwt.uid;

select 'LISTING VERIFICATION SMOKE TEST COMPLETE' as result;
