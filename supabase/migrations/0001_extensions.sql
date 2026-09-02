-- Phase 1: Foundation
-- Extensions required across the schema.

create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "citext";   -- case-insensitive email/slug comparisons

-- Generic updated_at maintenance, reused by every table with an updated_at column.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
