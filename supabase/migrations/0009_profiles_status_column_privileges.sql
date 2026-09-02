-- Phase 1 security fix: the profiles_update RLS policy (0006) authorizes rows
-- (id = auth.uid() OR user.edit), not columns. RLS alone does not stop a
-- self-authenticated user from PATCHing their own `status` directly via
-- PostgREST, completely bypassing set_profile_status()'s permission checks
-- (self-approval). Column-level privileges close this regardless of what the
-- TypeScript Database type happens to allow.
--
-- Important Postgres subtlety: you cannot "narrow" an existing table-level
-- GRANT UPDATE with a column-level REVOKE — a table-level grant already
-- authorizes every column, and a column-level REVOKE only ever removes a
-- column-level grant entry, which never existed here. The only way to
-- actually restrict this is to revoke the table-level privilege entirely and
-- re-grant UPDATE on just the columns a session should be able to touch
-- directly.
--
-- set_profile_status() still works regardless: SECURITY DEFINER functions run
-- their internal SQL as the function's owner (the migration-running role,
-- which owns every object here), never subject to grants held by
-- authenticated/anon.

revoke update on profiles from authenticated, anon;

grant update (organization_id, organization_name, full_name, phone, messenger_contact, address)
  on profiles to authenticated;
