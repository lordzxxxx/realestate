-- FOR LOCAL TESTING ONLY. Never run this against a real Supabase project —
-- Supabase already provides the auth schema, auth.users table, and auth.uid().
-- This stub exists so migrations can be validated against plain PostgreSQL.

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.uid', true), '')::uuid $$;
