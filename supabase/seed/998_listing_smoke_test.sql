-- Local smoke test only. Verifies: listing creation forces DRAFT regardless
-- of client payload, submit/approve/publish flow, trusted publish_directly
-- shortcut, status transition permission checks, RLS visibility scoping,
-- private contact access rules, and revision/version tracking. Depends on
-- 999_smoke_test.sql having been run first (reuses its users/org/roles).

\set ON_ERROR_STOP on

-- Grant COMPANY_AGENT (trusted, publish_directly) to the agent, and set up a
-- second, untrusted EXTERNAL_AGENT to compare against. The organization's id
-- is regenerated every run, so look it up by its stable slug instead of
-- hardcoding a UUID from a previous run.
do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from organizations where slug = 'main-realty-co';

  insert into user_roles (user_id, role_id, organization_id)
  select '22222222-2222-2222-2222-222222222222', r.id, v_org_id
  from roles r where r.name = 'COMPANY_AGENT'
  on conflict do nothing;

  update profiles set organization_id = v_org_id where id = '22222222-2222-2222-2222-222222222222';
end $$;

insert into auth.users (id, email, raw_user_meta_data)
values ('44444444-4444-4444-4444-444444444444', 'untrusted@example.com',
        '{"full_name":"Untrusted Agent","user_category":"EXTERNAL_AGENT"}'::jsonb);

do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from organizations where slug = 'main-realty-co';
  update profiles set status = 'ACTIVE', organization_id = v_org_id where id = '44444444-4444-4444-4444-444444444444';

  insert into user_roles (user_id, role_id, organization_id)
  select '44444444-4444-4444-4444-444444444444', r.id, v_org_id
  from roles r where r.name = 'EXTERNAL_AGENT'
  on conflict do nothing;
end $$;

-- 1. Trusted agent creates a listing, attempting to fabricate an already-live
--    status and history — must be forced back to DRAFT regardless.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

do $$
declare
  v_org_id uuid;
  v_listing_id uuid;
  v_status listing_status;
begin
  select id into v_org_id from organizations where slug = 'main-realty-co';

  insert into listings (organization_id, listing_type, property_type, property_name, monthly_rent, bedrooms, created_by, status, approved_at, published_at)
  values (v_org_id, 'RENT', 'CONDOMINIUM', 'Six Senses', 35000, 2, '22222222-2222-2222-2222-222222222222', 'AVAILABLE', now(), now())
  returning id, status into v_listing_id, v_status;

  if v_status != 'DRAFT' then
    raise exception 'SECURITY BUG: listing created with status % instead of DRAFT', v_status;
  end if;

  raise notice 'OK: listing forced to DRAFT despite AVAILABLE payload (id=%)', v_listing_id;

  perform set_config('reos.test_listing_id', v_listing_id::text, false);
end $$;

reset role;
reset request.jwt.uid;

-- 2. Trusted agent submits — should skip review and land directly on AVAILABLE.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

select (submit_listing(current_setting('reos.test_listing_id')::uuid)).status as trusted_submit_status;

reset role;
reset request.jwt.uid;

-- 3. Untrusted agent creates their own listing and submits — should land on
--    PENDING_REVIEW, NOT AVAILABLE.
set role authenticated;
set request.jwt.uid = '44444444-4444-4444-4444-444444444444';

do $$
declare
  v_org_id uuid;
  v_listing_id uuid;
begin
  select id into v_org_id from organizations where slug = 'main-realty-co';

  insert into listings (organization_id, listing_type, property_type, property_name, monthly_rent, created_by)
  values (v_org_id, 'RENT', 'CONDOMINIUM', 'Palm Beach Villas', 30000, '44444444-4444-4444-4444-444444444444')
  returning id into v_listing_id;

  perform set_config('reos.untrusted_listing_id', v_listing_id::text, false);
end $$;

select (submit_listing(current_setting('reos.untrusted_listing_id')::uuid)).status as untrusted_submit_status;

-- 4. Untrusted agent tries to approve their OWN pending listing directly —
--    must fail (no listing.approve permission).
do $$
begin
  begin
    perform set_listing_status(current_setting('reos.untrusted_listing_id')::uuid, 'AVAILABLE', null);
    raise exception 'SECURITY BUG: untrusted agent published without approval';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: untrusted agent blocked from self-publishing (%)', sqlerrm;
  end;
end $$;

-- 5. Untrusted agent tries to fabricate approval via a direct column UPDATE
--    (bypassing set_listing_status entirely).
do $$
begin
  begin
    update listings set status = 'AVAILABLE' where id = current_setting('reos.untrusted_listing_id')::uuid;
    raise exception 'SECURITY BUG: direct status UPDATE succeeded on listings';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then raise; end if;
    raise notice 'OK: direct listings status UPDATE blocked by column privileges (%)', sqlerrm;
  end;
end $$;

reset role;
reset request.jwt.uid;

-- 6. Admin (COMPANY_ADMIN/SUPER_ADMIN from 999) approves & publishes in one action.
set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';

select (approve_and_publish_listing(current_setting('reos.untrusted_listing_id')::uuid, 'Looks good')).status as admin_published_status;

reset role;
reset request.jwt.uid;

-- 7. Visibility: a third, unrelated org member should NOT see either listing
--    (no read_organization/read_all grant, not creator/assignee).
insert into auth.users (id, email, raw_user_meta_data)
values ('55555555-5555-5555-5555-555555555555', 'outsider@example.com',
        '{"full_name":"Outsider","user_category":"KEY_HOLDER"}'::jsonb);

do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from organizations where slug = 'main-realty-co';
  update profiles set status = 'ACTIVE', organization_id = v_org_id where id = '55555555-5555-5555-5555-555555555555';
  insert into user_roles (user_id, role_id, organization_id)
  select '55555555-5555-5555-5555-555555555555', r.id, v_org_id from roles r where r.name = 'KEY_HOLDER'
  on conflict do nothing;
end $$;

set role authenticated;
set request.jwt.uid = '55555555-5555-5555-5555-555555555555';

select count(*) as outsider_sees_zero_listings from listings;

reset role;
reset request.jwt.uid;

-- 8. Private contacts: the trusted agent (creator) can add one; the outsider
--    (KEY_HOLDER with no view_private_contacts and not assigned) cannot see it.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

insert into listing_contacts (listing_id, contact_type, name, phone)
values (current_setting('reos.test_listing_id')::uuid, 'OWNER', 'Property Owner Jane', '09170000001');

select count(*) as creator_sees_own_contact from listing_contacts where listing_id = current_setting('reos.test_listing_id')::uuid;

reset role;
reset request.jwt.uid;

set role authenticated;
set request.jwt.uid = '55555555-5555-5555-5555-555555555555';

select count(*) as outsider_sees_private_contacts from listing_contacts where listing_id = current_setting('reos.test_listing_id')::uuid;

reset role;
reset request.jwt.uid;

-- 9. Revisions: price change bumps version and records a revision row.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

update listings set monthly_rent = 32000 where id = current_setting('reos.test_listing_id')::uuid;

select version, monthly_rent from listings where id = current_setting('reos.test_listing_id')::uuid;
select count(*) as revision_count from listing_revisions where listing_id = current_setting('reos.test_listing_id')::uuid;

reset role;
reset request.jwt.uid;

-- 10. Trusted-publisher resubmit-after-changes-requested shortcut. A fresh
--     listing is walked DRAFT -> PENDING_REVIEW -> CHANGES_REQUESTED (the
--     only way to reach CHANGES_REQUESTED per the transition matrix), then
--     submit_listing() must take it straight to AVAILABLE (not just back to
--     PENDING_REVIEW), exercising the CHANGES_REQUESTED->AVAILABLE fix.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

do $$
declare
  v_org_id uuid;
  v_listing_id uuid;
begin
  select id into v_org_id from organizations where slug = 'main-realty-co';

  insert into listings (organization_id, listing_type, property_type, property_name, monthly_rent, created_by)
  values (v_org_id, 'RENT', 'CONDOMINIUM', 'Boracay Building', 28000, '22222222-2222-2222-2222-222222222222')
  returning id into v_listing_id;

  perform set_config('reos.resubmit_listing_id', v_listing_id::text, false);
end $$;

select (set_listing_status(current_setting('reos.resubmit_listing_id')::uuid, 'PENDING_REVIEW', null)).status as walked_to_pending;

reset role;
reset request.jwt.uid;

set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';

select (set_listing_status(current_setting('reos.resubmit_listing_id')::uuid, 'CHANGES_REQUESTED', 'Please add more photos')).status as sent_back_status;

reset role;
reset request.jwt.uid;

set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

select (submit_listing(current_setting('reos.resubmit_listing_id')::uuid)).status as trusted_resubmit_status;

reset role;
reset request.jwt.uid;

select 'LISTING SMOKE TEST COMPLETE' as result;
