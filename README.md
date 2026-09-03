# Real Estate OS

A centralized real estate management, listing, agent-collaboration, and
automated-publishing platform. Property data is entered once in a single
PostgreSQL source of truth; automation (public website, Facebook, Google
Sheets, notifications) is layered on top in later phases without ever
becoming the source of truth itself.

Full requirements: see the project brief this was built from (not included
in this repo). Build proceeds phase-by-phase; each phase is fully working
before the next starts — no placeholder CRUD, no fake "synced" statuses.

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
order** (`0001` through `0016`). Do not run anything under `supabase/seed/`
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
```

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
      organizations/      CRUD + settings
      admin/approvals/          pending-user review
      admin/listing-approvals/  pending-listing review queue
      listings/           card-list w/ status tabs + quick actions, new (manual form /
                           paste-parser), [id]/{overview,images,contacts,history}
    auth/callback/    email-confirmation redirect handler
    pending-approval/ shown to logged-in users awaiting approval
  components/
    ui/               small hand-rolled primitives (button, input, select)
    nav/, layout/     sidebar, topbar
  lib/
    supabase/         browser/server/service-role clients + proxy session refresh
    auth/             session lookup, permission checks, zod schemas
    organizations/    zod schemas
    listings/         zod schemas (client-facing + server-authoritative), constants,
                       paste-parser, get-listing helper
  types/database.ts   hand-written Supabase Database type (regenerate once
                       a real project exists: see comment at top of file)
supabase/
  migrations/         0001–0016, run in order against a real Supabase project
  seed/               LOCAL POSTGRES TEST FIXTURES ONLY — do not run against Supabase
scripts/
  bootstrap-admin.ts  one-time first-admin promotion (service role)
```

## Verification performed

- All 16 migrations (`0016`'s Storage-only pieces aside — see note above)
  applied cleanly against local PostgreSQL 16, in order, with no errors.
- `supabase/seed/999_smoke_test.sql` and `998_listing_smoke_test.sql` both
  pass end-to-end — see the scenario list two sections up.
- `npm run typecheck` and `npm run lint` both pass with zero errors/warnings.
- `npm run build` (production build, which type-checks and compiles every
  route including dynamic `[id]` segments regardless of runtime redirects)
  passes cleanly after every phase.
- Every route in `(dashboard)` and `pending-approval` correctly 307-redirects
  unauthenticated requests to `/login?next=...` (verified against a running
  dev server) — note this only proves the redirect layer, not that a page
  renders correctly once past it, which is what the production build check
  above covers instead.

What is **not** verified (requires a real Supabase project, which wasn't
provisioned per the build decisions made at the start of this work): actual
email delivery, the full browser auth flow against real Supabase
Auth/PostgREST, Storage upload/download against a real bucket, and the UI
rendering with real data end-to-end in a browser.
