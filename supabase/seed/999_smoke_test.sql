-- Local smoke test only. Verifies: profile auto-creation, has_permission(),
-- RLS enforcement, and the approval RPC. Not part of the real migration set.

\set ON_ERROR_STOP on

-- 1. Register two auth users: one destined to become SUPER_ADMIN (bootstrap
--    simulation), one ordinary external agent registrant.
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'admin@example.com',
        '{"full_name":"Admin User","user_category":"EXTERNAL_AGENT"}'::jsonb);

insert into auth.users (id, email, raw_user_meta_data)
values ('22222222-2222-2222-2222-222222222222', 'agent@example.com',
        '{"full_name":"New Agent","user_category":"EXTERNAL_AGENT","phone":"09171234567"}'::jsonb);

-- profile auto-created by trigger, status PENDING
select id, full_name, user_category, status from profiles order by created_at;

-- 2. Bootstrap: promote admin@example.com to ACTIVE + SUPER_ADMIN (this is what
--    scripts/bootstrap-admin.ts will do with the service role key in real use).
update profiles set status = 'ACTIVE' where id = '11111111-1111-1111-1111-111111111111';

insert into user_roles (user_id, role_id, organization_id)
select '11111111-1111-1111-1111-111111111111', id, null from roles where name = 'SUPER_ADMIN';

select has_permission('11111111-1111-1111-1111-111111111111', 'organization.create', null) as admin_can_create_org;
select has_permission('22222222-2222-2222-2222-222222222222', 'organization.create', null) as agent_can_create_org;

-- 3. RLS as the admin: can create an org, can see the pending agent profile.
set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';

insert into organizations (name, slug, created_by) values ('Main Realty Co', 'main-realty-co', '11111111-1111-1111-1111-111111111111')
returning id, name;

select count(*) as admin_sees_all_profiles from profiles;

reset role;
reset request.jwt.uid;

-- 4. RLS as the pending agent: should NOT be able to create an org, and should
--    only see their own profile (not the admin's).
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

select count(*) as agent_sees_only_self from profiles;

do $$
begin
  begin
    insert into organizations (name, slug) values ('Rogue Org', 'rogue-org');
    raise exception 'SECURITY BUG: agent was able to create an organization';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then
      raise;
    end if;
    raise notice 'OK: agent blocked from creating organization (%)', sqlerrm;
  end;
end $$;

reset role;
reset request.jwt.uid;

-- 5. Approval RPC: admin approves the pending agent.
set role authenticated;
set request.jwt.uid = '11111111-1111-1111-1111-111111111111';

select (set_profile_status('22222222-2222-2222-2222-222222222222', 'ACTIVE')).status as agent_status_after_approval;

reset role;
reset request.jwt.uid;

-- 6. Approval RPC should reject a non-privileged caller.
set role authenticated;
set request.jwt.uid = '22222222-2222-2222-2222-222222222222';

do $$
begin
  begin
    perform set_profile_status('22222222-2222-2222-2222-222222222222', 'ACTIVE');
    raise exception 'SECURITY BUG: agent approved their own profile';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then
      raise;
    end if;
    raise notice 'OK: agent blocked from self-approval (%)', sqlerrm;
  end;
end $$;

reset role;
reset request.jwt.uid;

-- 7. Direct-UPDATE bypass attempt: a second pending registrant tries to PATCH
--    their own status to ACTIVE directly (skipping set_profile_status()
--    entirely). Must fail on column privileges, not just app-level logic.
insert into auth.users (id, email, raw_user_meta_data)
values ('33333333-3333-3333-3333-333333333333', 'sneaky@example.com',
        '{"full_name":"Sneaky Registrant","user_category":"EXTERNAL_AGENT"}'::jsonb);

set role authenticated;
set request.jwt.uid = '33333333-3333-3333-3333-333333333333';

do $$
begin
  begin
    update profiles set status = 'ACTIVE' where id = '33333333-3333-3333-3333-333333333333';
    raise exception 'SECURITY BUG: registrant self-approved via direct UPDATE';
  exception when others then
    if sqlerrm like 'SECURITY BUG%' then
      raise;
    end if;
    raise notice 'OK: direct status UPDATE blocked by column privileges (%)', sqlerrm;
  end;
end $$;

reset role;
reset request.jwt.uid;

select 'SMOKE TEST COMPLETE' as result;
