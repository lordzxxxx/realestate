-- Phase 1: registration needs a free-text org/company field (section 9) for
-- external registrants whose organization doesn't exist in the system yet.
-- This is distinct from organization_id (the real FK, set once management
-- links the profile to an actual organizations row).

alter table profiles add column organization_name text;

comment on column profiles.organization_name is
  'Free-text company name captured at registration, before/instead of a real organization_id link.';

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category user_category;
begin
  v_category := coalesce(
    (new.raw_user_meta_data ->> 'user_category')::user_category,
    'EXTERNAL_AGENT'
  );

  perform assert_registration_category(v_category);

  insert into profiles (
    id, organization_id, organization_name, full_name, email, phone, user_category,
    status, messenger_contact, address, terms_accepted_at
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid,
    new.raw_user_meta_data ->> 'organization_name',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    v_category,
    'PENDING',
    new.raw_user_meta_data ->> 'messenger_contact',
    new.raw_user_meta_data ->> 'address',
    case when (new.raw_user_meta_data ->> 'terms_accepted') = 'true' then now() else null end
  );

  return new;
end;
$$;
