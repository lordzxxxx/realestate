# Real Estate OS

A centralized real estate management, listing, agent-collaboration, and
automated-publishing platform. Property data is entered once in a single
PostgreSQL source of truth; automation (public website, Facebook, Google
Sheets, notifications) is layered on top in later phases without ever
becoming the source of truth itself.

Full requirements: see the project brief this was built from (not included
in this repo). Build proceeds phase-by-phase; each phase is fully working
before the next starts — no placeholder CRUD, no fake "synced" statuses.

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

Not built yet (later phases, per the phased plan): properties, images,
public marketplace, the automation engine/job queue, Facebook, Google
Sheets, inquiries/viewings, reports, audit logs.

## Why you can trust the RBAC/RLS layer specifically

This project ships without a live Supabase project (see below), so instead
of leaving the database layer unverified, every migration was applied
against a real local PostgreSQL 16 instance and exercised end-to-end:
registration trigger → profile creation → permission grants → RLS-filtered
reads → the approval RPC → and a deliberate privilege-escalation attempt
(a non-admin user trying to self-approve, both via the RPC and via a raw
column UPDATE). See `supabase/seed/999_smoke_test.sql` for the exact
scenarios and `supabase/seed/000_stub_auth_schema.sql` /
`supabase/seed/001_stub_grants.sql` for how a bare Postgres is made to look
enough like Supabase (a stub `auth.users`/`auth.uid()`, and the
`authenticated`/`anon` roles Supabase's platform sets up automatically) to
run that test. **Those two `seed/` files are dev-only fixtures — never run
them against a real Supabase project**, which already provides both.

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
order** (`0001` through `0009`). Do not run anything under `supabase/seed/`
against a real project — those are local-Postgres-only test fixtures.

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
    (dashboard)/      protected app shell: dashboard, organizations, admin/approvals
    auth/callback/    email-confirmation redirect handler
    pending-approval/ shown to logged-in users awaiting approval
  components/
    ui/               small hand-rolled primitives (button, input, select)
    nav/, layout/     sidebar, topbar
  lib/
    supabase/         browser/server/service-role clients + proxy session refresh
    auth/             session lookup, permission checks, zod schemas
    organizations/    zod schemas
  types/database.ts   hand-written Supabase Database type (regenerate once
                       a real project exists: see comment at top of file)
supabase/
  migrations/         0001–0009, run in order against a real Supabase project
  seed/               LOCAL POSTGRES TEST FIXTURES ONLY — do not run against Supabase
scripts/
  bootstrap-admin.ts  one-time first-admin promotion (service role)
```

## Verification performed this phase

- All 9 migrations applied cleanly against local PostgreSQL 16, in order,
  with no errors.
- `supabase/seed/999_smoke_test.sql` passes end-to-end: registration →
  profile auto-creation → permission checks → RLS row filtering → the
  approval RPC → two blocked privilege-escalation attempts (self-approval
  via RPC, self-approval via raw column UPDATE).
- `npm run typecheck` and `npm run lint` both pass with zero errors/warnings.
- Every route in `(dashboard)` and `pending-approval` correctly 307-redirects
  unauthenticated requests to `/login?next=...` (verified against a running
  dev server).

What is **not** verified (requires a real Supabase project, which wasn't
provisioned for this phase per the build decisions made at the start):
actual email delivery, the full browser auth flow against real
Supabase Auth/PostgREST, and the UI rendering with real data end-to-end.
