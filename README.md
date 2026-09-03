# Real Estate OS

A centralized real estate management, listing, agent-collaboration, and
automated-publishing platform. Property data is entered once in a single
PostgreSQL source of truth; automation (public website, Facebook, Google
Sheets, notifications) is layered on top in later phases without ever
becoming the source of truth itself.

Full requirements: see the project brief this was built from (not included
in this repo). Build proceeded phase-by-phase; each phase was fully
working before the next started — no placeholder CRUD, no fake "synced"
statuses. **All 10 planned phases are now complete** (see `## Status`
sections below, newest first, for what each one actually built and
verified — and each phase's own honest account of what stayed
unverifiable without a real Supabase project). What's left is exactly
what `DEPLOYMENT.md` describes: provisioning a real backend and running
through its go-live checklist.

## Status: Phase 10 — Production Security, Performance, QA, Deployment (complete)

The final phase — all 10 are now complete. This one hardens what the
previous nine built rather than adding new features, and produces the
[`DEPLOYMENT.md`](./DEPLOYMENT.md) runbook someone actually deploying this
needs. See that file's "Known scaling considerations" for what's
deliberately deferred rather than silently absent.

- **Security headers + CSP** (`next.config.ts`) — a static, nonce-free CSP
  (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, HSTS). Deliberately *not*
  nonce-based: a proxy-injected nonce would force every page into dynamic
  rendering, regressing the static optimization `/login`, `/register`,
  `/about`, `/contact`, and `/check-email` already get — confirmed
  unaffected by checking the production build output still marks them
  static (○) after adding the headers. `img-src`/`connect-src` are scoped
  to the actual Supabase hostname (parsed from `NEXT_PUBLIC_SUPABASE_URL`
  at build time) rather than a blanket `https:`, and `next.config.ts` also
  gained the `images.remotePatterns` entry `next/image` requires for that
  same host — a real gap found while doing this, since nothing in this
  sandbox ever loaded a real listing photo through it to surface the
  error.
- **Rate limiting** (`src/lib/rate-limit.ts`) — a small in-memory,
  per-IP, fixed-window limiter (no new infrastructure, per this phase's
  own scoping decision) applied to every anon-facing mutation: the public
  inquiry and viewing-request forms (5 per 10 minutes), login (10 per 10
  minutes — blunts credential stuffing without a per-email limit, which
  would leak whether an email is registered), and registration (5 per
  hour — spam here is costlier than a login attempt, since each one
  creates a real pending profile someone has to review). Its own
  limitation is stated in the code and in `DEPLOYMENT.md`, not glossed
  over: this is per-server-process state, so a multi-instance serverless
  deployment gets a looser *effective* limit than the number suggests —
  good enough to blunt casual spam, and the upgrade path (Upstash Redis)
  is documented for when that's not enough.
- **Missing indexes** (`0028`) — found by reading every `.order()`/`.eq()`
  call against tables across all 9 previous phases against the indexes
  already in place, not by guessing: `automation_events`/
  `integration_logs`/`inquiries`/`viewing_requests`/`listings` all sort by
  `created_at` (or `updated_at`) with no supporting index anywhere, and
  the "needs verification" predicate (`status = 'AVAILABLE' and
  last_verified_at is null or < cutoff`) — which independently appears in
  the dashboard, the listings page, *and* the Phase 8 reminder cascade —
  only had a single-column index on `status` before this. Also fixed in
  the same pass: the Automation Center's job-queue counts were pulling
  every row in `sync_jobs` (a table with no retention policy, so it only
  ever grows) into Node just to tally statuses — replaced with seven
  count-only queries, one per status.
- **Pagination** — `/listings`, `/admin/audit`, `/inquiries`, and
  `/viewings` all previously fetched every visible row (or, for the audit
  log, a fixed cap of 100 with no way to see past it). All four now use
  plain GET-link pagination (`src/components/ui/pagination.tsx`,
  `src/lib/pagination.ts`) — no client JS, bookmarkable/shareable URLs,
  same philosophy as the Phase 4 public search pages.
- **Responsive QA** — a Playwright pass (Chromium, ad hoc for this
  verification — not added as a project dependency) screenshotted every
  page that renders without a live backend (`/login`, `/register`,
  `/about`, `/contact`, `/check-email`) at phone/tablet/desktop widths and
  checked for horizontal overflow programmatically. No issues found —
  Phase 3's mobile-first work on the Agent Portal and consistent Tailwind
  breakpoint usage throughout held up. Authenticated, data-backed pages
  couldn't be checked this way for the same reason they can't be manually
  clicked through: no live Supabase project exists in this sandbox.
- **Deployment runbook** (`DEPLOYMENT.md`) — a concrete, in-order
  sequence: provision Supabase, set every env var, deploy, bootstrap the
  first admin against the *real* project, then a verification checklist
  covering everything that was structurally impossible to verify in this
  sandbox (real email delivery, a real
  Google Sheets/Facebook connection, the cron job actually firing on
  schedule).

**Post-write correction, found only once an actual Vercel deploy was
attempted**: this phase originally shipped a `vercel.json` with a
`crons` entry running every 5 minutes. Vercel rejected the deploy —
Hobby-plan accounts only allow once-daily cron jobs, a limit this
sandbox had no way to hit since it never had a real Vercel project to
deploy to. Fixed by deleting `vercel.json` and driving the worker from a
GitHub Actions scheduled workflow instead
(`.github/workflows/cron-process-jobs.yml`), which needs no paid plan.
`DEPLOYMENT.md` documents the two repository secrets it needs
(`SITE_URL`, `CRON_SECRET`) and the option to swap back to Vercel's own
cron if the project ever upgrades to Pro.

## Status: Phase 9 — Reports, Audit, Automation Center (complete)

Three observability surfaces on top of data that has existed since Phase 5
but was deliberately backend-only until now — Phase 5's own comment said
it plainly: "`automation_events`/`sync_jobs`/`integration_logs` stay
backend-only... until Phase 9 builds the actual Automation Center on top
of them." No new tables, no new migration — this phase is entirely
application code over existing schema and existing RLS.

- **Reports** (`/reports`, `src/lib/reports/`) — scoped deliberately
  narrow per this phase's own decision: operational aggregates only
  (listings by status, active listing value, verification compliance %,
  inquiries/viewings funnels), no agent-performance metrics. Every query is
  a plain authenticated `select` with **no manual own/organization/all
  branching in application code** — `listings_select`/`inquiries_select`/
  `viewing_requests_select`'s RLS policies (already keyed off
  `listing.read_*`/`inquiry.view_*`/`viewing.view`, which the same roles
  hold alongside their `reports.*` grants) already scope exactly which
  rows a given session can aggregate over. Reimplementing that scoping
  here would just be a second, driftable copy of a decision the database
  already makes correctly — the page only checks `reports.view_own/
  organization/all` (via `canAny()` over `getMyPermissions()`, the same
  "any org" check nav visibility already uses) to decide whether to render
  at all. `reports.export` is a distinct, narrower permission several
  seeded roles deliberately don't hold (`COMPANY_AGENT`,
  `PARTNER_BUSINESS_MEMBER`, `BROKER` can view but not export) — checked
  separately, both in the UI and again in `/api/reports/export`, which
  streams the same aggregates back as one small multi-section CSV.
- **Audit Log** (`/admin/audit`) — a browsable `automation_events` feed,
  gated by `audit.view` (already seeded to roles since Phase 1, never
  exposed in any UI until now), with a resource-type filter and links back
  to the underlying listing/user where one exists.
- **Automation Center** (`/admin/automation`) — job-queue counts by
  status, a dead-letter queue (any job type/platform, not
  integration-specific), and a recent `integration_logs` feed. **The one
  actual UI consolidation this phase makes**: Phase 7's Facebook-specific
  "failed posts" list and its `retrySyncJobAction` moved here entirely —
  `retry_sync_job()` (built generic in Phase 7 specifically because
  `integrations.retry`'s own description was never Facebook-specific) now
  has the one general home its own design already implied, instead of a
  second, narrower copy of the same retry button living on the org
  settings page. The Google Sheets card's "Sync all now" stays where it
  is — that's a deliberate bulk resync action, not error recovery, and is
  a genuinely different feature from retrying a single dead-lettered job.
- Nothing here changes what counts as a "meaningful" automation event or
  sync job — this phase is purely a new way to look at data the last four
  phases already produced correctly.

## Status: Phase 8 — Verification Automation (complete)

Phase 5's stale-listing reminder was deliberately scoped as a precursor —
"a lightweight ... precursor to Phase 8's fuller verification workflow,
not a reimplementation of it." This phase is that fuller workflow: a
two-tier escalation, plus the actual mechanism an agent uses to respond to
it (which didn't exist until now — the only way to reset
`last_verified_at` before this phase was to toggle a listing's status away
and back).

- **`verify_listing()`** (`0027`) — the "Confirm still available" action.
  `last_verified_at` has been column-locked from direct client `UPDATE`
  since `0013` (same as `status`/other timestamps), so this follows the
  exact same pattern as `assign_listing_agent()` (`0014`): permission-
  checked (`listing_actor_has()`, the same creator/assigned-agent-or-
  broader-permission check used throughout the listings domain), touches
  only the one column it owns. Deliberately does **not** bump `version` —
  `listing_change_is_meaningful()` doesn't list `last_verified_at`, so
  there's no new `listing_revisions` snapshot and no fresh Sheets/Facebook
  sync job for what is "confirmed, nothing changed" rather than a content
  edit. Verified in the smoke test: an unrelated outsider is blocked, the
  actual owner/assigned agent succeeds, and status/version/revision-count
  are all provably unchanged by it.
- **Two-tier escalation**, extending `enqueueStaleListingReminders()` in
  the cron worker: day 7 still reminds the assigned agent (unchanged from
  Phase 5); day 14 additionally notifies every `listing.approve` holder in
  the org (`notify_users_with_permission()`, already built in Phase 5,
  simply not yet used for this) that the listing needs attention. **No
  automatic status change at either tier** — per this build's running
  rule that status transitions stay a human decision (section 14's "do not
  permanently delete... automatically" extends in spirit to "do not
  silently unpublish either"), this only ever adds visibility, never takes
  the decision out of a human's hands.
- **UI**: a "Confirm Available" quick action on the listings list (next to
  Reserve/Mark Rented/Mark Sold, appearing only when a listing is
  `AVAILABLE` and actually stale) and a matching "Confirm Still Available"
  on the listing detail page's status panel.

## Status: Phase 7 — Facebook Page Integration (complete)

Unlike Phase 6's shared Google service account, a Facebook Page can only be
posted to with a token authorized for that specific Page — there's no
platform-level credential that works across every organization. This phase
deliberately does **not** build a full Facebook Login OAuth flow (a
registered Meta App, redirect handling, short-lived-to-long-lived token
exchange, eventual App Review for page permissions — none of it
exercisable in this sandbox without a real Meta App anyway): an org admin
pastes their own Page ID and a long-lived Page Access Token, generated
externally via Meta Business Suite or the Graph API Explorer, same "paste a
credential you generated yourself" spirit as Phase 6's spreadsheet ID —
except the token itself is a real secret, which changes the schema design
in one important way.

- **Schema** (`0025`): `facebook_page_connections` (auto-provisioned per
  org, like `google_sheet_connections`) and `facebook_post_records`
  (Listing ID → Facebook post ID mapping, same stable-key idea as Phase 6's
  `sheet_sync_records`, so an edit updates the existing post's message
  instead of creating a duplicate). **The one real difference from Phase
  6**: `access_token` is a live credential, not an identifier, so it gets
  column-level lockdown on top of the row-level policy — `REVOKE SELECT`
  entirely, then `GRANT SELECT` back on every column except `access_token`.
  `UPDATE` stays granted on all columns (Postgres doesn't require `SELECT`
  on a column to blindly overwrite it), so staff can rotate a token but
  never read one back — not through this table, not through `.select()`
  after an update, not at all. Verified in the smoke test as a *Postgres*
  guarantee, not just an RLS one: even the SUPER_ADMIN, connected as role
  `authenticated` with global `integrations.manage`, gets `permission
  denied for table facebook_page_connections` on a bare `SELECT
  access_token` — RBAC permissions and Postgres column grants are
  independent layers, and this phase is the first to actually need both at
  once.
- **Dispatch trigger** (`0026`) fires on listing insert/update, but with a
  narrower gate than Sheets: Facebook posting is public marketing, not an
  internal record, so it only ever fires for a listing that's genuinely
  publicly visible right now — reusing `is_publicly_visible()` (the exact
  predicate the public site itself uses, migration `0017`) rather than
  inventing a second, possibly-diverging definition of "should this be
  public". Also checks the listing's own `facebook_enabled`/
  `auto_sync_enabled` toggles and `organization_settings.auto_publish_facebook`.
- **The real Graph API client** (`src/lib/facebook/graph.ts`) — plain
  `fetch` calls to Facebook's REST
  endpoints (no SDK dependency needed: every call here is one form-encoded
  POST or one query-string GET), `testPageConnection()` (confirms the token
  actually authorizes *this* Page — a token for a different Page a user
  manages would otherwise look superficially valid), and
  `upsertListingPost()` (edits the existing post's message by ID when
  `facebook_post_records` already has one, otherwise creates a new link
  post — a Facebook link post's attached URL/preview can't be swapped after
  creation the way a spreadsheet row can be freely overwritten, so only the
  caption updates on subsequent edits). The link posted is the property's
  own public page, so Facebook's link-preview card reuses the OG tags Phase
  4 already built — no photo upload API needed.
- **Worker handler** wired into the same cron route as Phase 6, with the
  same "surface the error on the connection immediately" behavior on
  failure.
- **No bulk reconciliation, unlike Phase 6's "Sync all now" — by design,
  not an oversight**: a spreadsheet row can be safely overwritten
  repeatedly with zero cost, but a Facebook Post is public and visible to
  followers. A "post everything now" button would spam a Page with
  duplicate/near-duplicate posts the moment an org with hundreds of
  existing listings first connects. Instead: **`retry_sync_job()`**, a
  small, genuinely generic addition (not Facebook-specific — it's exactly
  what `integrations.retry`'s own description in `0007` already promised:
  "Manually retry a failed sync job", a gap that existed since Phase 5 with
  no way to fill it short of Phase 6's blanket reconcile). Permission-
  checked internally, and refuses to touch anything that isn't already
  `FAILED_REQUIRES_ATTENTION` — retrying an in-flight job would race the
  worker that's already processing it.
- **A subtle test-writing trap found and fixed while building the smoke
  test, not a product bug**: the natural way to verify "a plain agent
  can't retry someone else's dead-lettered job" is to look the job up by
  its known `idempotency_key` and pass that id to `retry_sync_job()` as
  that agent. But the agent also lacks `integrations.view`, so
  `sync_jobs_select`'s RLS policy hides the row from that very lookup —
  the id resolves to `NULL`, and `retry_sync_job(NULL)` fails with "job not
  found" rather than a permission error. The test would have silently kept
  "passing" even if the function's internal permission check were deleted
  entirely — it just wouldn't have been testing that check anymore. Fixed
  by capturing job ids into session GUCs (`set_config`/`current_setting`)
  while still unrestricted, before ever assuming a restricted role's
  identity — those reads never touch RLS at all, so what fails afterward
  can only be the permission check.
- **Settings UI**: a new "Facebook Page integration" section on
  `/organizations/[id]`, gated by `integrations.view`/
  `integrations.manage`/`integrations.facebook`, with the access token
  field always blank on load (the server never sends the real value back —
  `Row` in `database.ts` legitimately includes `access_token` for the
  worker's service-role client to read, but every authenticated fetch in
  application code explicitly names its safe columns and never selects it)
  and a save action that treats a blank token field as "keep the one
  already saved" rather than forcing a re-paste on every unrelated edit. A
  small failed-posts list with per-listing Retry buttons stands in for the
  bulk reconcile this phase deliberately omits.

## Status: Phase 6 — Google Sheets Integration (complete)

The `SHEETS_UPSERT_ROW`/`GOOGLE_SHEETS` job type Phase 5 deliberately left
unmanufactured now has a real handler: a shared Google service account (one
platform-level credential, not per-org OAuth) syncs each organization's
listings to their own connected spreadsheet.

- **Schema** (`0023`): `google_sheet_connections` (one row per org,
  auto-provisioned by trigger — same pattern as `organization_settings` in
  `0005` — so the settings page always has a row to read/update) and
  `sheet_sync_records` (section 27's "use Listing ID as the stable mapping
  key" — which spreadsheet row a listing already occupies, so a later sync
  updates in place instead of appending a duplicate). Both staff-viewable
  via `integrations.view`; connection settings writable via
  `integrations.manage`/`integrations.google`; `sheet_sync_records` is
  worker-only bookkeeping — no INSERT/UPDATE grant exists for
  `authenticated`/`anon` at all.
- **Dispatch trigger** (`0024`) fires on every listing insert/update,
  gated by three independent checks that all have to pass: the listing's
  own `google_sheets_enabled`/`auto_sync_enabled` toggles (columns that
  have existed on `listings` since `0010`, unused until now),
  `organization_settings.auto_sync_google_sheets` (**a real gap found and
  fixed while building this**: that org-level kill switch has existed
  since `0005` too, and nothing before this phase actually consulted it —
  the trigger and `reconcile_google_sheets()` both check it now), and the
  org's connection actually being `CONNECTED` with a `spreadsheet_id` set.
  The job payload carries every field the worker needs (property name,
  price, status, assigned agent's name, ...) pre-denormalized at enqueue
  time, so the worker never needs a second round-trip back to `listings`.
- **A trigger-ordering bug found by the smoke test, not by inspection**:
  the natural first draft of "changing the spreadsheet target resets
  `status` to `DISCONNECTED`" (a `BEFORE UPDATE` trigger) also clobbered a
  legitimate `status = 'CONNECTED'` write sent in the *same* `UPDATE`
  statement — the trigger can't distinguish "the client just explicitly
  asked for CONNECTED" from "status merely carried over unchanged". Fixed
  at the call-site convention, not by making the trigger smarter: "Save
  settings" (`spreadsheet_id`/`property_sheet_name` only) and "Test
  connection" (`status`/`last_checked_at`/`last_error` only) are always
  two separate writes, documented with a comment on both server actions and
  the smoke test that exercises it, so a future edit can't accidentally
  recombine them.
- **The real Sheets API client** (`src/lib/google/sheets.ts`) — service
  account JWT auth via `googleapis`, column-order contract shared with the
  worker, header-row management that never clobbers existing content,
  `testSheetsConnection()` (verifies the named tab actually exists — a
  spreadsheet ID typo or wrong tab name fails loudly instead of silently
  writing to the wrong place), and `upsertListingRow()` (updates in place
  by row number when `sheet_sync_records` already has one, otherwise
  appends and parses the new row number back out of the API's response
  range). Every export throws a clear, specific error when
  `GOOGLE_SERVICE_ACCOUNT_KEY` isn't configured, rather than silently
  no-op'ing.
- **Worker handler** (`src/app/api/cron/process-jobs/route.ts`): looks up
  the listing's existing row (if any) via `sheet_sync_records`, calls
  `upsertListingRow()`, records the row number back, and clears/sets the
  connection's `status`/`last_error` based on the outcome — a failure
  surfaces on the settings page immediately (not just after the full
  retry→dead-letter cycle finishes minutes later).
- **Manual reconciliation**: `reconcile_google_sheets()` (permission-checked
  internally, unlike Phase 5's revoked-from-authenticated helpers, since
  it's meant to be called directly from the "Sync all now" button) force-
  requeues every eligible listing in an org even when nothing changed —
  keyed on a fresh run ID rather than `listing.version`, so it actually
  requeues instead of no-op'ing against jobs the per-change trigger already
  enqueued.
- **Settings UI**: a new "Google Sheets integration" section on
  `/organizations/[id]`, gated the same way as everything else on that page
  (`integrations.view` to see it, `integrations.manage`/`integrations.google`
  to edit) — service account email + share instructions, spreadsheet
  ID/URL + tab name fields, Save/Test/Sync-all-now, status badge, and a
  warning when the org-level auto-sync switch is off even though the
  connection itself is verified.

**Inert until real credentials exist** (same pattern as every external
integration in this build): `GOOGLE_SERVICE_ACCOUNT_KEY` is unset in this
sandbox, so `getServiceAccountEmail()` returns null (the settings page
shows a setup instruction instead of crashing) and any real API call fails
with a clear "GOOGLE_SERVICE_ACCOUNT_KEY is not set" error, caught and
surfaced the same way a real Google API error would be — nothing pretends
to succeed.

## Status: Phase 5 — Automation Engine (complete)

The outbox pattern end to end: a DB transaction that changes something
meaningful (a listing submitted/published/reserved/rented/sold, its price
changed, its agent reassigned, a user registering/getting approved, an
inquiry or viewing request coming in) writes `automation_events` +
`sync_jobs` in the *same transaction*, via triggers — so it can never be
forgotten by application code, and fires the same way whether the change
came from a server action, the bootstrap script, or any future admin tool.
A separate worker claims and processes those jobs asynchronously, with
retry, backoff, dead-lettering, and full observability.

**Scoped deliberately**: Phase 6/7 (Facebook, Google Sheets) don't exist
yet — no OAuth, no stored credentials, no way to actually post or sync
anything external. Rather than have the dispatcher create
`FACEBOOK_CREATE_POST`/`SHEETS_CREATE_ROW` jobs that would sit forever
unprocessable, every event above only ever enqueues `SEND_NOTIFICATION`
jobs — a real, fully-internal job type that proves the entire
event→job→worker→retry→observability pipeline without manufacturing jobs
that can never succeed. `job_type`/`platform` are plain text columns
specifically so Phase 6/7 can introduce new job types without a migration.

- **Schema** (`0019`): `automation_events`, `sync_jobs` (job status enum
  matching section 30 exactly, unique `idempotency_key`), `integration_logs`,
  `notifications`. All four are staff-viewable (gated by `audit.view`/
  `integrations.view`) but writable only through SECURITY DEFINER functions
  — no direct INSERT/UPDATE/DELETE grant exists for `authenticated`/`anon`
  on any of them, `notifications` included (a user can only flip their own
  `read_at`, via the same row-RLS + column-grant combination used for
  `profiles.status` in Phase 1).
- **Helper functions** (`0020`): `create_automation_event()`,
  `enqueue_sync_job()` (idempotent via `ON CONFLICT (idempotency_key) DO
  NOTHING`), `enqueue_notification_job()`, `notify_users_with_permission()`
  (mirrors `has_permission()`'s own global-vs-org-scoped semantics — useful
  since a fresh external registrant usually has no `organization_id` yet).
  **A privilege-escalation vector closed here, not assumed safe**: Supabase
  auto-exposes every function with `PUBLIC` execute as an RPC endpoint
  callable by any authenticated session — these take arbitrary
  `user_id`/`organization_id` parameters with no internal permission check
  (unlike `set_listing_status()` etc., which check `has_permission()`
  internally and are meant to be called directly). Left as default, any
  logged-in user could forge a notification to any other user via
  `supabase.rpc('enqueue_notification_job', {...})`. Each is explicitly
  `REVOKE EXECUTE ... FROM public, authenticated, anon` — verified in the
  smoke test by attempting exactly that forgery and confirming it's
  rejected with a real permission-denied error, not just "no button for
  it in the UI".
- **Triggers** (`0021`) wiring the events listed above. Each trigger
  function must itself be `SECURITY DEFINER` (not just the helpers it
  calls) — a trigger fired by an ordinary user's own UPDATE runs as that
  role by default, and would otherwise fail calling a function whose
  EXECUTE was just revoked from that same role.
- **Worker functions** (`0022`): `claim_next_sync_jobs()` (atomic
  `SELECT ... FOR UPDATE SKIP LOCKED`, which cannot be expressed through
  PostgREST's REST API at all — this is the one part of the pipeline that
  *had* to be a SQL function, not a supabase-js query), `complete_sync_job()`
  (backoff schedule 1min/5min/15min across `max_attempts` = 4, then
  `FAILED_REQUIRES_ATTENTION` — matches section 32's example exactly), and
  `reclaim_stuck_sync_jobs()` (section 77: a worker that dies mid-job
  between claiming and completing would otherwise leave it `PROCESSING`
  forever, invisible to future claims).
- **The worker itself**: `/api/cron/process-jobs`, a secret-protected Route
  Handler (`CRON_SECRET`, checked as `Authorization: Bearer $CRON_SECRET` —
  Vercel Cron's own convention, so it works whether Vercel Cron or any
  other scheduler calls it) using the service-role client. Each run:
  reclaims stuck jobs, scans `AVAILABLE` listings for a stale/missing
  `last_verified_at` and enqueues one `LISTING_VERIFICATION_DUE` reminder
  per listing per day (idempotency key includes the date — a lightweight,
  honestly-scoped precursor to Phase 8's fuller verification workflow, not
  a reimplementation of it), then claims and processes a batch of jobs.
  `notifications.sync_job_id` is `UNIQUE` as a second, schema-level safety
  net against a worker crash between inserting the notification and
  marking the job complete ever producing a duplicate.
- **Minimal notifications UI** — a topbar bell with unread count and
  `/notifications` (mark one or all read). Deliberately the *only* new UI
  surface this phase: `automation_events`/`sync_jobs`/`integration_logs`
  stay backend-only, verified via SQL, until Phase 9 builds the actual
  Automation Center on top of them — building a second, smaller version of
  that dashboard now would just be thrown away later.

### Setting up the cron schedule once deployed

Add a `CRON_SECRET` environment variable in your deployment (generate one
with `openssl rand -hex 32`), then either:

- **GitHub Actions (what this repo actually uses)**:
  `.github/workflows/cron-process-jobs.yml` hits
  `/api/cron/process-jobs` every 5 minutes. Add two repository secrets —
  `SITE_URL` (`https://<your-domain>`) and `CRON_SECRET` (same value as
  the Vercel env var) — under Settings → Secrets and variables → Actions,
  and it starts running on schedule. No paid plan required.
- **Vercel Cron**: only an option on Vercel **Pro** or higher — its
  Hobby plan allows once-daily cron jobs only, which rejects a
  `vercel.json` asking for every 5 minutes (found the hard way: an
  earlier version of this repo shipped exactly that `vercel.json`, and
  Vercel refused the deploy). If you're on Pro, add a `vercel.json` with
  a `crons` entry pointing at the same path and remove the GitHub Actions
  workflow — Vercel sends the `Authorization` header automatically once
  `CRON_SECRET` is set on the project.
- **Any other scheduler**: hit the same URL with
  `Authorization: Bearer <CRON_SECRET>` on your own interval — a free
  service like cron-job.org works too.

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full go-live sequence.

## Status: Phase 4 — Public Marketplace, Inquiries, Viewings (complete)

Every RLS policy up through Phase 3 was `to authenticated` only — an
anonymous visitor got zero rows from anything. This phase makes the site
genuinely public where it should be, without weakening anything else:

- **Routing inverted**: `proxy.ts` used to enumerate public paths and
  protect everything else; now it enumerates the protected app shell
  (`/dashboard`, `/listings`, `/organizations`, `/admin`, `/inquiries`,
  `/viewings`, `/pending-approval`) and defaults everything else — `/`,
  `/properties`, `/for-rent`, `/for-sale`, `/about`, `/contact` — to public.
  `/` is now the real marketplace homepage, not a dashboard redirect.
- **Public RLS** (migration `0017`) — `listings`/`listing_images`/
  `listing_amenities`/`amenities` get `to public` SELECT policies scoped to
  an `is_publicly_visible()` predicate: `website_enabled` AND status in
  (`AVAILABLE`/`RESERVED`/`RENTED`/`SOLD`/`TEMPORARILY_UNAVAILABLE`) — a
  rented or sold unit's page stays reachable (marked as such), a draft
  never does. `listing_contacts` (private) is untouched — still
  authenticated-only.
- **A subtler leak found and fixed in application code, not SQL**: the
  property-details query fetches by slug with no status filter and relies
  on RLS — but RLS is per-session, not per-"is this genuinely public". A
  logged-in staff member browsing the public site with their own
  `read_own` access would have their own DRAFT listing render on the
  public template, since RLS legitimately lets *them* see it. Fixed by
  having `getPublicListingBySlug()` independently re-check
  `is_publicly_visible` in application code — the public template now
  refuses to render anything not actually public, regardless of who's
  asking.
- **Inquiries + viewing requests** (migration `0018`) — public (anon)
  INSERT restricted to publicly-visible listings, with auto-assignment to
  the listing's `assigned_agent_id` (section 37) via trigger. Internal read/
  update scoped by `inquiry.view_own`/`view_organization`/`view_all` and
  `viewing.view`/`manage`/`assign`.
- **A real Postgres RLS subtlety found via the smoke test, worth knowing
  for any future anon-insert code**: `INSERT ... RETURNING` requires a
  SELECT-satisfying policy to hand the row back — anon has no SELECT
  policy on `inquiries`/`viewing_requests` at all (there's deliberately no
  public "my inquiries" view), so `RETURNING` failed with "new row
  violates row-level security policy" even though the `WITH CHECK`
  condition demonstrably passed in isolation. Every anon insert in this
  codebase (server actions in `properties/[slug]/actions.ts`) deliberately
  omits `.select()` for this reason.
- **Search & browse** — `/properties` (+ `/for-rent`, `/for-sale` sharing
  the same component with a forced type), filters (name, rent/sale, type,
  city, bedrooms, price range, furnishing, available-only) and sort
  (newest/price/recently-verified) via a plain GET form — no client JS
  required, shareable/bookmarkable URLs, works on slow connections.
- **Property details page** with photo gallery, unit details, amenities/
  nearby, generated SEO title/description/OG per section 16, related
  properties, and the Inquire/Schedule Viewing forms.
- **Internal Inquiries/Viewings pages** (`/inquiries`, `/viewings`) so the
  data those public forms create is actually reachable and actionable by
  staff, not just sitting in the database.

## Status: Phase 3 — Approval System, Agent Portal (complete)

Phase 3 is entirely application-layer — no new migrations — since the
approval RPCs, RLS policies, and permission model it relies on were already
built (and privilege-escalation-tested) in Phases 1–2. It adds:

- **Listing approval queue** (`/admin/listing-approvals`, gated by
  `listing.approve`) — every `PENDING_REVIEW` listing the reviewer can see
  (scoped by the same `listing.read_organization`/`read_all` RLS as
  everywhere else), oldest-first, with inline Approve & Publish / Request
  Changes / Reject actions. This is the queue section 2's "Management
  receives notification → clicks APPROVE & PUBLISH" implies but Phase 2
  didn't have — reviewing a pending listing previously required already
  knowing its URL.
- **Real operational dashboard** (section 41) — replaced the Phase 1
  placeholder with actual counts (Total/Available/Reserved/Rented+Sold/
  Pending Review/Needs Verification) and a recent-listings list, all
  naturally RLS-scoped to what the signed-in user can see. No decorative
  filler, and no cards for inquiries/viewings/integration health — those
  don't exist until their phases do, and a fake zero would misrepresent
  that.
- **Agent Portal quick actions** (section 40) — the `/listings` list is now
  a card list (not a table — the previous table would have needed
  horizontal scroll on a phone, which section 63 explicitly rules out),
  with status filter tabs (including a "Needs Verification" tab: `AVAILABLE`
  listings whose `last_verified_at` is null or older than 7 days) and 1–2
  inline quick-action buttons per listing (Reserve/Mark Rented/Mark Sold/
  Back to Available) that update status without opening the full listing
  page. This is a filter, not automation — the actual reminder/notification
  system for stale listings is Phase 8's job-queue work.

**Not independently re-verified against local Postgres**: the
`needs_verification` tab's `.or('last_verified_at.is.null,last_verified_at.lt.<cutoff>')`
filter uses PostgREST's filter-string syntax, which only a running
PostgREST instance can parse — the local test harness in this repo talks to
plain Postgres directly via `psql`, with no PostgREST in front of it, so
this one query is unverified until it runs against a real Supabase
project. Everything else this phase touches (RLS visibility, the approval
RPCs) was already covered by the Phase 1–2 smoke tests, which still pass
unchanged since no migration changed.

## Status: Phase 2 — Property Domain (complete)

Built and verified in this phase:

- **Listings schema** — `listings`, `listing_images`, `listing_contacts`
  (private), `amenities`/`listing_amenities`, `listing_status_history`,
  `listing_revisions` (`supabase/migrations/0010`–`0016`). Auto-generated
  `listing_number` (`RENT-2026-000001`) and unique `slug`, both assigned by
  `handle_new_listing()` regardless of what a client sends.
- **Status transition engine** — `set_listing_status()` enforces the section
  72 transition matrix (DRAFT → PENDING_REVIEW → APPROVED → AVAILABLE →
  RESERVED/RENTED/SOLD/TEMPORARILY_UNAVAILABLE → ARCHIVED, plus
  CHANGES_REQUESTED/REJECTED), each transition gated by its own specific
  permission. `submit_listing()` gives trusted publishers
  (`listing.publish_directly`) a DRAFT/CHANGES_REQUESTED → AVAILABLE
  shortcut; everyone else lands on PENDING_REVIEW.
  `approve_and_publish_listing()` combines approve+publish into the single
  action section 73 describes.
- **A second privilege-escalation class found and fixed**: unlike `profiles`
  (Phase 1), a fresh `INSERT` has no column-level restriction the way
  `UPDATE` does — a client could otherwise `INSERT` a listing that's already
  `AVAILABLE`/`SOLD` with fabricated approval timestamps, skipping the
  entire review workflow. `handle_new_listing()` now forces
  `status = 'DRAFT'` and clears every automatic timestamp on every insert,
  regardless of payload. Column-level `UPDATE` grants (migration `0013`)
  separately lock down `status`/timestamps/`version`/`assigned_agent_id` the
  same way Phase 1 locked down `profiles.status`.
- **Revisions & versioning** (sections 48–49) — a `BEFORE` trigger bumps
  `listings.version` on any field a sync job would care about; an `AFTER`
  trigger snapshots the row into `listing_revisions`. (They have to be two
  triggers: a `BEFORE` trigger can mutate the row but the row doesn't exist
  in `listings` yet, so a child-table insert would fail its foreign key; an
  `AFTER` trigger sees the committed row but can't mutate it to persist a
  version bump. Found via the local smoke test, not assumed correct.)
- **Property CRUD** — full manual entry form covering section 11's fields
  (unit details, price, location, amenities/nearby locations), plus a
  **paste-parser** (section 10) that heuristically extracts fields from
  pasted text and always routes through a review step — parsing only ever
  pre-fills the same form, it never saves or publishes directly.
- **Drag-and-drop image uploader** — Supabase Storage, reorderable
  (`@dnd-kit`), cover-image flag, captions; storage bucket policies
  (migration `0016`) re-derive the same ownership/permission check as
  `listing_images` RLS from the upload path's `{listing_id}/...` prefix.
- **Private contacts** — owner/key-holder/representative info in a separate
  table, visible to the listing's creator/assigned agent or anyone holding
  `listing.view_private_contacts`, and to no one else.
- **Activity timeline** — status history + revisions on the listing's
  History tab.

Not built yet: the public marketplace, the automation engine/job queue,
Facebook, Google Sheets, inquiries/viewings, reports, audit logs (later
phases).

## Status: Phase 1 — Foundation (complete)

Built and verified in this phase:

- **Database schema** — `organizations`, `profiles`, `roles`, `permissions`,
  `role_permissions`, `user_roles`, `system_settings`, `organization_settings`
  (`supabase/migrations/0001`–`0009`).
- **RBAC** — real server/database authorization via a `has_permission()` SQL
  function used both by RLS policies and application code (not
  frontend-only nav hiding). 52 permissions seeded across 11 default roles
  (one per user category), editable later via `rbac.manage`.
- **Row Level Security** on every table, including a subtlety worth calling
  out: RLS governs *rows*, not *columns*. A user's own `profiles` row is
  self-editable, but `status`/`approved_at`/`approved_by`/`suspended_at`/
  `archived_at` are additionally locked down via column-level `GRANT`s
  (migration `0009`) so a user cannot self-approve by PATCHing their own
  status directly — only `set_profile_status()` (a `SECURITY DEFINER`
  function that re-checks the specific permission for the transition) can
  change those columns. This was caught and fixed via the local smoke test
  described below, not assumed safe.
- **Auth** — registration (with account-type selection per section 9 of the
  brief), email verification, login, logout, session refresh via `proxy.ts`
  (Next.js 16 renamed `middleware` to `proxy` — see note below).
- **Approval workflow** — new registrations land as `PENDING`; a user with
  `user.approve` reviews and approves/rejects them at `/admin/approvals`.
- **Organizations CRUD** — list/create/edit, plus per-organization automation
  toggles (`auto_publish_website`, `auto_publish_facebook`,
  `auto_sync_google_sheets`, etc.) that later phases will actually read.
- **App shell** — permission-filtered sidebar, dashboard home.

(Properties/images/private contacts landed in Phase 2, below.)

## Why you can trust the RBAC/RLS layer specifically

This project ships without a live Supabase project (see below), so instead
of leaving the database layer unverified, every migration was applied
against a real local PostgreSQL 16 instance and exercised end-to-end:
registration trigger → profile creation → permission grants → RLS-filtered
reads → the approval RPC → and a deliberate privilege-escalation attempt
(a non-admin user trying to self-approve, both via the RPC and via a raw
column UPDATE) — see `supabase/seed/999_smoke_test.sql`. Phase 2 extends the
same approach for listings in `supabase/seed/998_listing_smoke_test.sql`:
listing creation forcing DRAFT regardless of payload, the trusted
`publish_directly` shortcut vs. the normal PENDING_REVIEW path, a blocked
self-publish attempt (both via the transition RPC and via a raw column
UPDATE), RLS visibility scoping (an unrelated org member sees zero
listings), private-contact access rules, and revision/version tracking on
a price change.

`supabase/seed/000_stub_auth_schema.sql` / `supabase/seed/001_stub_grants.sql`
make a bare Postgres look enough like Supabase (a stub `auth.users`/
`auth.uid()`, and the `authenticated`/`anon` roles Supabase's platform sets
up automatically) to run those tests. **Those two `seed/` files are dev-only
fixtures — never run them against a real Supabase project**, which already
provides both. Run all four seed files together and in order
(`000` → `001` → `999` → `998`) to reproduce the full local verification —
`998` depends on the organization/users `999` creates.

## Setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com) (or run one
locally with the Supabase CLI, if you have Docker available). You'll need:

- Project URL
- `anon` public key
- `service_role` secret key (server-only — never expose this to the client)

### 2. Run the migrations

In the Supabase SQL Editor (or via the Supabase CLI's `supabase db push`
against a linked project), run every file in `supabase/migrations/` **in
order** (`0001` through `0028`). Do not run anything under `supabase/seed/`
against a real project — those are local-Postgres-only test fixtures.

Migration `0016` creates the `listing-images` Storage bucket and its
policies — it touches the `storage` schema, which only exists on a real
Supabase project (Storage is a managed service, not plain Postgres), so
it's the one migration that could never be exercised against the local
test harness described below. Its policies mirror the same
ownership/permission logic as `listing_images`' own RLS (0013), just
re-derived from the upload path's `{listing_id}/...` prefix — read it
alongside 0013 rather than trusting it blind.

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server-only, never expose to the client
CRON_SECRET=<random secret>                    # server-only; protects /api/cron/process-jobs (Phase 5)
GOOGLE_SERVICE_ACCOUNT_KEY=<service account JSON, one line>  # server-only (Phase 6); see .env.local.example
NEXT_PUBLIC_SITE_URL=https://<your-domain>     # used to build absolute listing/post URLs from background workers
```

Facebook Page tokens (Phase 7) are **not** an env var — they're pasted per
organization into the "Facebook Page integration" section on each org's
settings page, since (unlike the Google service account) a single
platform-level credential can't post to every org's own distinct Page.

In your Supabase project's Auth settings, add
`http://localhost:3000/auth/callback` (and your production URL's
equivalent) as a redirect URL, so email confirmation links work.

### 4. Install and run

```bash
npm install
npm run dev
```

### 5. Bootstrap your first admin

Every admin action requires an existing privileged user — so the very
first admin can't be created through the app UI. Register a normal account
at `/register`, confirm its email, then run:

```bash
npm run bootstrap-admin -- you@example.com "Your Company Name"
```

This grants that account `SUPER_ADMIN` (platform-wide, not scoped to one
organization) and optionally creates your first organization. The
organization name argument is optional.

**Design note on scoping:** grant `SUPER_ADMIN`/`COMPANY_ADMIN`/
`MANAGEMENT` roles *globally* (`organization_id = null` in `user_roles`,
which is what the bootstrap script does) if that person should review and
approve every registrant regardless of which organization they claim on
the registration form — this matters because a brand-new external
registrant usually has no `organization_id` yet (just a free-text
`organization_name` hint), and an *org-scoped* admin role will not see
those in `/admin/approvals` (by design — `has_permission()` only treats a
`null`-scoped grant as "matches any organization"). Reserve org-scoped
`PARTNER_BUSINESS_ADMIN` grants for people who should only manage their own
organization's people and listings.

## Next.js 16 note

This project uses Next.js 16, which renamed the `middleware.ts` file
convention to `proxy.ts` (`export function proxy` instead of `export
function middleware`). If you're used to `middleware.ts`, that's why the
route-protection logic lives in `src/proxy.ts` /
`src/lib/supabase/proxy.ts`. It's a UX redirect layer only — every server
action and route handler enforces its own permission check independently
(`src/lib/auth/permissions.ts`), and RLS enforces it again at the database
layer, so nothing security-relevant depends on `proxy.ts` alone.

## Project layout

```
src/
  app/
    (auth)/           login, register, check-email + server actions
    (dashboard)/      protected app shell
      dashboard/          real operational stats (section 41)
      organizations/      CRUD + settings + Google Sheets (Phase 6) + Facebook Page (Phase 7)
                           integration sections
      admin/approvals/          pending-user review
      admin/listing-approvals/  pending-listing review queue
      admin/audit/              automation_events feed, gated by audit.view (Phase 9)
      admin/automation/         job-queue health, dead-letter queue + generic retry,
                                 integration_logs feed (Phase 9)
      listings/           card-list w/ status tabs + quick actions (incl. Phase 8's
                           "Confirm Available"), new (manual form / paste-parser),
                           [id]/{overview,images,contacts,history}
      inquiries/, viewings/  internal management for what the public forms create
      reports/            operational aggregates, RLS-scoped, gated by reports.view_*
                           (Phase 9)
      notifications/      bell dropdown target + mark-read (Phase 5)
    (public)/         genuinely public, no auth — proxy.ts defaults here (see note above)
      page.tsx            marketplace homepage (was the old `/` dashboard-redirect)
      properties/         browse/search; [slug]/ property details + Inquire/Schedule
                           Viewing forms + their server actions
      for-rent/, for-sale/  same search component as properties/, forced listing_type
      about/, contact/    minimal static pages
    api/cron/process-jobs/  the automation worker (Phase 5) — secret-protected Route Handler,
                             now also handling SHEETS_UPSERT_ROW (Phase 6) and
                             FACEBOOK_UPSERT_POST (Phase 7) jobs
    api/reports/export/     CSV export, gated by reports.export separately from
                             reports.view_* (Phase 9)
    auth/callback/    email-confirmation redirect handler
    pending-approval/ shown to logged-in users awaiting approval
  components/
    ui/               small hand-rolled primitives (button, input, select,
                       pagination — Phase 10)
    nav/, layout/     sidebar, topbar (topbar now also renders the notification bell)
    public/           property card, search form, gallery, site header/footer
  lib/
    supabase/         browser/server/service-role clients + proxy session refresh
    auth/             session lookup, permission checks, zod schemas
    organizations/    zod schemas
    listings/         zod schemas (client-facing + server-authoritative), constants,
                       paste-parser, get-listing helper
    google/           Sheets API client (service account JWT), zod schemas (Phase 6)
    facebook/         Graph API client (page access token, plain fetch), zod schemas (Phase 7)
    reports/          RLS-scoped aggregate queries + CSV builder (Phase 9)
    public/           search filter parsing, public listing queries (with the
                       is_publicly_visible re-check described above), inquiry/viewing
                       zod schemas
    rate-limit.ts     in-memory per-IP limiter for anon-facing mutations (Phase 10)
    pagination.ts     shared page/range helpers for the list pages (Phase 10)
  types/database.ts   hand-written Supabase Database type (regenerate once
                       a real project exists: see comment at top of file)
supabase/
  migrations/         0001–0028, run in order against a real Supabase project
  seed/               LOCAL POSTGRES TEST FIXTURES ONLY — do not run against Supabase
scripts/
  bootstrap-admin.ts  one-time first-admin promotion (service role)
.github/workflows/
  cron-process-jobs.yml  drives /api/cron/process-jobs every 5 minutes —
                          GitHub Actions rather than Vercel Cron, since
                          Vercel's free Hobby plan only allows once-daily
                          cron (Phase 10)
DEPLOYMENT.md          go-live runbook: Supabase setup, env vars, deploy,
                       worker schedule, bootstrap, verification checklist
                       (Phase 10)
```

## Verification performed

- All 28 migrations (`0016`'s Storage-only pieces aside — see note above)
  applied cleanly against local PostgreSQL 16, in order, with no errors.
- Seven smoke tests pass end-to-end, run in order (each depends on data from
  the previous ones): `999_smoke_test.sql` (auth/RBAC/RLS),
  `998_listing_smoke_test.sql` (listings domain),
  `997_inquiries_smoke_test.sql` (public insert + auto-assignment +
  visibility scoping, including the anon-cannot-RETURNING discovery),
  `996_automation_smoke_test.sql` (Phase 5: trigger → event → job creation,
  idempotency, the RPC-forgery attempt blocked, atomic claiming, the full
  retry→backoff→dead-letter lifecycle, stuck-job reclamation, and
  notifications RLS/column lockdown), `995_google_sheets_smoke_test.sql`
  (Phase 6: no job is queued while `DISCONNECTED`; exactly one job queued
  once `CONNECTED`, carrying the correct denormalized payload; changing the
  spreadsheet target resets `status` to `DISCONNECTED`; an ordinary agent is
  blocked from connecting a sheet or calling `reconcile_google_sheets()`;
  reconciliation force-requeues every eligible listing), and
  `994_facebook_smoke_test.sql` (Phase 7: no job queued for a listing that
  isn't genuinely publicly visible or while `DISCONNECTED`; the
  column-level `REVOKE` on `access_token` actually blocks a bare `SELECT`
  as role `authenticated` — proven even for the SUPER_ADMIN, since Postgres
  grants and RBAC permissions are independent layers; changing the
  Page/token resets `status` and clears the stale `page_name`;
  `retry_sync_job()` is permission-checked, refuses a non-dead-lettered
  job, and — the one test-design trap this phase's own smoke test caught
  in itself — its permission check is verified using a job id captured via
  a session GUC rather than a fresh RLS-visible `SELECT`, so a deleted
  permission check would actually fail the test instead of an RLS-hidden
  row silently producing the same "blocked" outcome for the wrong reason),
  and `993_listing_verification_smoke_test.sql` (Phase 8: an unrelated
  outsider is blocked from calling `verify_listing()`; the listing's own
  creator/assigned agent succeeds; `status`, `version`, and the
  `listing_revisions` count are all provably unchanged by a verification —
  confirming it really is a no-op on everything except `last_verified_at`,
  not just documented as one).
- Beyond the dedicated smoke tests, Phase 5's, Phase 6's, and Phase 7's
  pipelines were all also verified *organically*: running the pre-existing
  suites with the new triggers active produced exactly the
  automation_events/sync_jobs you'd expect from their existing scenarios —
  real application flows exercising the automation layer, not just a
  synthetic test written to match the implementation.
- Phase 9 added no migration and no new RLS, so the same rebuild above was
  re-run unchanged after that phase's code landed, confirming no
  regression — the correct verification for a phase that is entirely new
  queries over existing, already-tested schema.
- Phase 10 adds one migration (`0028`, indexes only — no new tables, no
  RLS changes) — the full 28-migration, seven-smoke-test rebuild was
  re-run after it, still green, and `pg_indexes` was queried directly to
  confirm all seven new indexes actually exist under their expected names.
- `npm run typecheck` and `npm run lint` both pass with zero errors/warnings.
- `npm run build` (production build, which type-checks and compiles every
  route including dynamic `[id]`/`[slug]` segments regardless of runtime
  redirects) passes cleanly after every phase — still 35 routes (Phase 10
  hardened existing routes rather than adding any); the build output was
  specifically checked to confirm `/login`, `/register`, `/about`,
  `/contact`, and `/check-email` still prerender as static (○) after
  adding the Phase 10 CSP/security headers, proving the nonce-free
  approach didn't force them into dynamic rendering.
- Every protected route (`(dashboard)`, `/admin/*`, `/inquiries`,
  `/viewings`, `/notifications`, `/pending-approval`, `/reports`, and
  `/organizations/[id]`/`/listings/[id]`, which carry earlier phases' UI)
  correctly 307-redirects unauthenticated requests to `/login?next=...` —
  including with a `?page=N` query string appended (Phase 10's
  pagination), confirming the redirect logic isn't confused by it; every
  public route (`/`, `/properties`, `/for-rent`, `/for-sale`, `/about`,
  `/contact`) does not redirect (verified against a running dev server).
  This only proves the redirect layer, not that a page renders correctly
  once past it — that's what the production build check covers instead.
- `curl -I` against a running dev server confirms the CSP, X-Frame-Options,
  and Strict-Transport-Security headers are actually present on responses,
  not just configured and unverified.
- The Phase 10 rate limiter's fixed-window algorithm was unit-verified in
  isolation (a standalone script exercising `checkRateLimit()`'s core
  logic): allows exactly `limit` calls within the window, blocks every
  call after that with a correct `retryAfterSeconds`. The full server
  action round-trip (a real anon visitor actually getting blocked)
  couldn't be exercised end-to-end without a live Supabase project, since
  Next.js Server Actions aren't a plain REST endpoint `curl` can invoke
  directly — but the check runs and returns before any Supabase call, so
  the logic itself is what matters here.
- A Playwright pass (Chromium, ad hoc — not added as a project dependency)
  screenshotted `/login`, `/register`, `/about`, `/contact`, and
  `/check-email` at phone (375px)/tablet (768px)/desktop (1440px) widths
  and checked `document.documentElement.scrollWidth` against the viewport
  at each — no horizontal overflow found anywhere.
- `/properties/does-not-exist` correctly 404s rather than crashing.
- `/api/cron/process-jobs` correctly 401s with no `Authorization` header and
  with a wrong secret, and — with the correct secret — actually attempts its
  real logic (fails only on the expected `ECONNREFUSED` to the placeholder
  Supabase URL, the same known limitation as every other data-dependent
  route in this sandbox, not a crash). `/api/reports/export` hits the same
  known limitation one step earlier — its own permission check
  (`getMyPermissions()`) already requires a Supabase round-trip, so an
  unauthenticated request 500s on the placeholder URL's `ECONNREFUSED`
  rather than cleanly 403ing the way `/api/cron/process-jobs` can (that
  route's secret check is a pure string comparison with no network
  involved) — a sandbox artifact of there being no live backend to
  authenticate against, not a missing permission check.

What is **not** verified (requires a real Supabase project and, for these
phases specifically, a real Google service account + spreadsheet and a real
Facebook Page + Page Access Token — none provisioned per the build
decisions made at the start of this work): actual email delivery, the full
browser auth flow against real Supabase Auth/PostgREST, Storage
upload/download against a real bucket, actually rendering pages with real
data in a browser, any real call to the Google Sheets API
(`getServiceAccountEmail()` returns null and every exported function
throws a clear "not configured" error with `GOOGLE_SERVICE_ACCOUNT_KEY`
unset, which is the behavior verified here; the actual HTTP calls in
`src/lib/google/sheets.ts` are unexercised until a real service account
and spreadsheet exist), and — specific to Phase 7 — any real call to the
Facebook Graph API (no default/placeholder credential exists for it at
all, by design — every organization starts `DISCONNECTED` with a null
`access_token` until an admin pastes one in; `src/lib/facebook/graph.ts`'s
actual HTTP calls are unexercised until a real Page + token exist), and —
specific to Phase 10 — an actual successful Vercel deployment (the first
real attempt is what surfaced the Hobby-plan cron rejection documented
above; the GitHub Actions workflow that replaced it has likewise never
fired for real yet), the rate limiter's behavior under Vercel's actual
multi-instance concurrency (only its single-process algorithm was
verified — see above), any authenticated/data-backed page's responsive
behavior on a real device (the Playwright pass covered only the
backend-independent public pages), and the `DEPLOYMENT.md` runbook itself,
which is necessarily unexercised until someone actually deploys this.
Pages that query
Supabase 500 in this sandbox (confirmed via the dev server log:
`ECONNREFUSED 127.0.0.1:54321`, the placeholder URL) — expected with no
backend, not a code defect, and consistent with every prior phase's
limitation.
