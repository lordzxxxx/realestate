-- Phase 1: Profiles
-- Users are separate from roles (section 7). A profile describes WHAT a user is;
-- roles (0004) determine WHAT they can do.

create type user_category as enum (
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'MANAGEMENT',
  'COMPANY_AGENT',
  'BROKER',
  'EXTERNAL_AGENT',
  'KEY_HOLDER',
  'PROPERTY_OWNER',
  'PROPERTY_REPRESENTATIVE',
  'PARTNER_BUSINESS_ADMIN',
  'PARTNER_BUSINESS_MEMBER'
);

create type profile_status as enum ('PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

create table profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  organization_id     uuid references organizations (id) on delete set null,
  full_name           text not null,
  email               citext not null,
  phone               text,
  user_category       user_category not null,
  status              profile_status not null default 'PENDING',
  messenger_contact   text,
  address             text,
  terms_accepted_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  approved_at         timestamptz,
  approved_by         uuid references profiles (id),
  suspended_at        timestamptz,
  archived_at         timestamptz
);

create index profiles_organization_id_idx on profiles (organization_id);
create index profiles_status_idx on profiles (status);
create index profiles_user_category_idx on profiles (user_category);

create trigger profiles_set_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- SUPER_ADMIN, COMPANY_ADMIN and MANAGEMENT are internal categories that must not
-- be self-selected at public registration time; only an already-privileged actor
-- (via the admin UI, which runs with the service role) may create those profiles.
create or replace function assert_registration_category(p_category user_category)
returns void
language plpgsql
as $$
begin
  if p_category in ('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGEMENT') then
    raise exception 'user_category % cannot be self-registered', p_category
      using errcode = '42501';
  end if;
end;
$$;

-- Auto-create a profile row whenever a new auth.users record is created.
-- Registration metadata is supplied via supabase.auth.signUp({ options: { data } }).
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
    id, organization_id, full_name, email, phone, user_category,
    status, messenger_contact, address, terms_accepted_at
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid,
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_auth_user();

alter table organizations
  add constraint organizations_created_by_fkey
    foreign key (created_by) references profiles (id),
  add constraint organizations_updated_by_fkey
    foreign key (updated_by) references profiles (id);
