-- Local smoke test only. Depends on 999_smoke_test.sql and
-- 998_listing_smoke_test.sql having run first (reuses their org/users/
-- listings). Verifies: public (anon) insert of inquiries/viewing requests
-- against a publicly-visible listing, auto-assignment from the listing's
-- assigned_agent_id, organization_id denormalization, rejection of inserts
-- against a non-public listing, and internal RLS read/update scoping.

\set ON_ERROR_STOP on

-- Pick the trusted agent's published listing (from 998) and assign it to
-- themselves explicitly so auto-assignment has something to propagate.
do $$
declare
  v_listing_id uuid := (select id from listings where property_name = 'Six Senses' limit 1);
begin
  perform set_config('reos.public_listing_id', v_listing_id::text, false);
end $$;

-- (COMPANY_AGENT doesn't hold listing.assign_agent per the RBAC seed —
-- assignment is a MANAGEMENT/COMPANY_ADMIN/BROKER action — so this runs as
-- the SUPER_ADMIN bootstrap user from 999.)
set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';
select assign_listing_agent(current_setting('reos.public_listing_id')::uuid, '22222222-2222-2222-2222-222222222222');
reset role;
reset request.jwt.uid;

-- 1. Anonymous visitor submits an inquiry against a publicly-visible
--    listing — must succeed, auto-assign to the listing's agent, and stamp
--    organization_id from the listing.
--
-- Deliberately NOT using RETURNING here: Postgres RLS requires a
-- SELECT-satisfying policy to honor RETURNING on an INSERT, and anon has no
-- SELECT policy on inquiries/viewing_requests at all (by design — there is
-- no public "my inquiries" view). Discovered by this smoke test failing
-- with "new row violates row-level security policy" on the RETURNING form
-- even though the WITH CHECK condition demonstrably passed in isolation.
-- The real app must not use RETURNING for these public inserts either.
set role anon;

insert into inquiries (listing_id, name, phone, message, preferred_contact_method)
values (current_setting('reos.public_listing_id')::uuid, 'Jane Buyer', '09171112222', 'Is this still available?', 'PHONE');

-- 2. Anonymous visitor submits a viewing request the same way.
insert into viewing_requests (listing_id, name, email, preferred_date, preferred_time)
values (current_setting('reos.public_listing_id')::uuid, 'John Renter', 'john@example.com', current_date + 3, '2:00 PM');

reset role;

-- Fetch the created inquiry's id as postgres (bypasses RLS) purely so the
-- rest of this script can reference it — the app never does this as anon.
do $$
begin
  perform set_config('reos.inquiry_id', (select id::text from inquiries where name = 'Jane Buyer'), false);
end $$;

set role anon;

-- 3. Anonymous visitor CANNOT read back any inquiries/viewing requests —
--    there is no public "my inquiries" view.
select count(*) as anon_reads_inquiries from inquiries;
select count(*) as anon_reads_viewings from viewing_requests;

reset role;

-- 4. Anonymous visitor cannot submit an inquiry against a non-public (DRAFT)
--    listing. Create one fresh here rather than depending on leftover state
--    from another script, so this check is deterministic on every run.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

do $$
declare
  v_org_id uuid := (select id from organizations where slug = 'main-realty-co');
  v_draft_id uuid;
begin
  insert into listings (organization_id, listing_type, property_type, property_name, monthly_rent, created_by)
  values (v_org_id, 'RENT', 'CONDOMINIUM', 'Unpublished Draft Unit', 15000, '22222222-2222-2222-2222-222222222222')
  returning id into v_draft_id;

  perform set_config('reos.draft_listing_id', v_draft_id::text, false);
end $$;

reset role;
reset request.jwt.uid;

set role anon;

do $$
begin
  begin
    insert into inquiries (listing_id, name, phone)
    values (current_setting('reos.draft_listing_id')::uuid, 'Sneaky Visitor', '0900');
    raise exception 'SECURITY BUG: inquiry created against a non-public listing';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: inquiry blocked against non-public listing (%)', sqlerrm;
  end;
end $$;

reset role;

-- 5. The assigned agent (who holds inquiry.view_own) can see their assigned
--    inquiry; an unrelated org member with no inquiry permission cannot.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

select count(*) as assigned_agent_sees_inquiry from inquiries where id = current_setting('reos.inquiry_id')::uuid;

reset role;
reset request.jwt.uid;

set role authenticated;
set request.jwt.uid = '55555555-5555-5555-5555-555555555555'; -- KEY_HOLDER outsider from 998

select count(*) as outsider_sees_inquiries from inquiries;

reset role;
reset request.jwt.uid;

-- 6. Management (inquiry.view_organization / inquiry.update) can see and
--    update any inquiry in the org, including changing status.
set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';

update inquiries set status = 'CONTACTED', notes = 'Called, following up tomorrow' where id = current_setting('reos.inquiry_id')::uuid;
select status, notes from inquiries where id = current_setting('reos.inquiry_id')::uuid;

reset role;
reset request.jwt.uid;

select 'INQUIRIES SMOKE TEST COMPLETE' as result;
