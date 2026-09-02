-- FOR LOCAL TESTING ONLY. Run this BEFORE any public-schema migrations (i.e.
-- right after 000_stub_auth_schema.sql). On a real Supabase project, this
-- ALTER DEFAULT PRIVILEGES setup already exists from project creation and
-- applies automatically to every table created afterwards — that's what we
-- reproduce here, so that a later migration's REVOKE (0009) runs in the same
-- relative order as it would in production: after the broad grant, narrowing
-- specific columns, with nothing after it silently re-widening them.

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, anon;
alter default privileges in schema public
  grant execute on functions to authenticated, anon;

grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
