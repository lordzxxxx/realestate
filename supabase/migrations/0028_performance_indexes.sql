-- Phase 10 (Performance): indexes for query patterns that exist in the
-- application but weren't covered by any migration through Phase 9 —
-- found by reading every `.order()`/`.eq()` call against these tables
-- against the indexes already in place (0002-0025), not by guessing.
--
-- Every prior migration's indexes were added alongside the feature that
-- needed them (RLS predicates, FK join columns); the ones below are the
-- first pass done as a dedicated review rather than per-feature, so they
-- skew toward "recent-first" list queries that only showed up once Phase 9
-- built real pages over automation_events/integration_logs.

-- Audit Log (Phase 9, /admin/audit): "recent events" with no resource_type
-- filter selected is the default view, and none of automation_events'
-- existing indexes (organization_id; resource_type+resource_id; event_type)
-- support `order by created_at desc limit 100` — every load would sort the
-- entire visible table.
create index automation_events_created_at_idx on automation_events (created_at desc);

-- Automation Center (Phase 9, /admin/automation): same gap for the
-- "recent activity" feed.
create index integration_logs_created_at_idx on integration_logs (created_at desc);

-- /inquiries and /viewings (Phase 4) both fetch every visible row ordered
-- by created_at desc with no index backing that sort.
create index inquiries_created_at_idx on inquiries (created_at desc);
create index viewing_requests_created_at_idx on viewing_requests (created_at desc);

-- /listings (Phase 3) sorts by updated_at desc; the dashboard's "Recent
-- Listings" (Phase 3) sorts by created_at desc with a LIMIT — a query
-- shape an index can satisfy without scanning the table at all, not just
-- speed up.
create index listings_updated_at_idx on listings (updated_at desc);
create index listings_created_at_idx on listings (created_at desc);

-- The "needs verification" predicate — `status = 'AVAILABLE' and
-- (last_verified_at is null or last_verified_at < cutoff)` — appears
-- verbatim in three places: the /listings "Needs Verification" tab
-- (Phase 3), the dashboard's count (Phase 3), and the cron worker's own
-- stale-listing scan that actually drives Phase 8's reminder/escalation
-- cascade. A single-column index on `status` alone (already present)
-- still has to check last_verified_at per matching row; this composite
-- lets the same index satisfy both conditions.
create index listings_status_last_verified_at_idx on listings (status, last_verified_at);
