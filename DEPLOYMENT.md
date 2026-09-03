# Deployment Runbook

The concrete, in-order sequence for taking this from a local checkout to a
live deployment. Written for Vercel + Supabase, since that's the stack
this app already assumes throughout — see the main `README.md` for
architecture context, and this file's own "Known scaling considerations"
at the bottom for what to revisit once real usage exists.

The background worker (`/api/cron/process-jobs`) is scheduled via a GitHub
Actions workflow (`.github/workflows/cron-process-jobs.yml`), not Vercel
Cron — Vercel's free Hobby plan only allows once-daily cron jobs, and this
worker needs to run every few minutes. If you're on Vercel Pro (or another
host with real cron support) you can point its scheduler at the same URL
instead and disable the GitHub Actions workflow; the app itself doesn't
care who calls it, only that the `Authorization: Bearer $CRON_SECRET`
header is correct.

## 1. Provision Supabase

1. Create a project at [supabase.com](https://supabase.com). Note the
   project URL, `anon` public key, and `service_role` secret key
   (Settings → API).
2. Run every file in `supabase/migrations/` **in order**, `0001` through
   the highest-numbered one in the repo, via the SQL Editor or
   `supabase db push` against a linked project. Do **not** run anything
   under `supabase/seed/` — those are local-Postgres-only test fixtures
   and will fail against a real project (they stub out Supabase's own
   `auth` schema, which already exists here).
3. Migration `0016` creates the `listing-images` Storage bucket and its
   policies as part of the migration itself — no separate manual bucket
   setup needed.
4. Auth → URL Configuration: add `https://<your-domain>/auth/callback` as
   a redirect URL (and `http://localhost:3000/auth/callback` too, if
   you'll still develop against this same project).
5. Auth → Email templates / SMTP: Supabase's default email sending has
   strict rate limits meant for development, not real registration
   volume. Configure a custom SMTP provider (Settings → Auth → SMTP
   Settings) before expecting real users to register.

## 2. Environment variables

Set these on the Vercel project (Settings → Environment Variables), not
just locally:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | From step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | From step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | From step 1 — server-only, never exposed to the client. Treat as a full-database-bypass credential. |
| `CRON_SECRET` | Yes | `openssl rand -hex 32`. Protects `/api/cron/process-jobs`. |
| `NEXT_PUBLIC_SITE_URL` | Yes | `https://<your-domain>`. Used for email redirect URLs and for building absolute listing/post URLs from the background worker, which has no incoming request to derive an origin from. |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Only if using Phase 6 | The full service-account JSON as one line. See `.env.local.example` for the exact shape and how an org "connects" its spreadsheet. |

Facebook Page credentials (Phase 7) are **not** an environment variable —
each organization pastes its own Page ID + long-lived Page Access Token
into that org's settings page in-app, since a single platform credential
can't post to every org's distinct Page the way the Google service
account can read every org's distinct spreadsheet.

## 3. Deploy

1. Connect the repo to a new Vercel project; it will detect Next.js
   automatically.
2. Set the environment variables from step 2 before the first deploy (or
   redeploy after setting them).

## 4. Set up the background worker schedule

The repo's `.github/workflows/cron-process-jobs.yml` calls
`/api/cron/process-jobs` every 5 minutes via GitHub Actions. To activate
it:

1. In the GitHub repo, go to Settings → Secrets and variables → Actions,
   and add two repository secrets:
   - `SITE_URL` — `https://<your-domain>` (no trailing slash)
   - `CRON_SECRET` — the exact same value set on Vercel in step 2
2. The workflow starts running on its schedule automatically once those
   secrets exist (GitHub Actions picks up `schedule` triggers as soon as
   the workflow file is on the default branch). To confirm it's live
   without waiting up to 5 minutes, trigger it manually: Actions tab →
   "Process automation jobs" → "Run workflow".
3. Known caveats, not silently glossed over: GitHub can delay scheduled
   runs by several minutes during periods of high platform load, and
   GitHub **disables scheduled workflows automatically after 60 days with
   no commits to the repo** — if jobs stop processing after a long quiet
   period, check Actions → this workflow for a "workflow disabled" banner
   and re-enable it there.
4. If you'd rather not depend on GitHub Actions at all: any scheduler that
   can hit a URL on an interval works identically — a free service like
   cron-job.org, or (if upgrading) Vercel Pro's own `vercel.json` cron
   support. Point it at the same URL with the same header and delete the
   GitHub Actions workflow.

## 5. Bootstrap the first admin

Every admin action requires an existing privileged user, so the very
first one can't be created through the app UI:

1. Register a normal account at `https://<your-domain>/register` and
   confirm its email.
2. Run the bootstrap script **against the production project** — either
   from a machine with the production env vars loaded (`vercel env pull`
   then `npm run bootstrap-admin -- ...` locally), or from a one-off shell
   wherever the Vercel env vars are available:
   ```bash
   npm run bootstrap-admin -- you@example.com "Your Company Name"
   ```
   This grants `SUPER_ADMIN` platform-wide (see the README's "Design note
   on scoping" for why global, not org-scoped, is usually what you want
   for this first account) and optionally creates the first organization.

## 6. Post-deploy verification checklist

Work through this once, live, before pointing real users at the
deployment — everything here was necessarily unverifiable in the sandbox
this was built in (no real Supabase project existed), so this is the
first time any of it runs for real:

- [ ] Homepage (`/`) loads the marketplace, not a 500 (confirms
      `NEXT_PUBLIC_SUPABASE_URL`/anon key are correct and reachable)
- [ ] Register → confirm email → login round-trip works
- [ ] Bootstrap-admin succeeds; the account can sign in and reach
      `/dashboard`
- [ ] Create a test organization, then a test listing through
      draft → submit → approve → publish
- [ ] The published listing's public page renders with correct
      photos/SEO/OG tags
- [ ] Submit a test inquiry and a test viewing request from the public
      listing page; confirm they appear in `/inquiries`/`/viewings` and
      the assigned agent gets a notification
- [ ] `curl -I https://<your-domain>/login` shows the CSP/security
      headers from `next.config.ts`
- [ ] Manually trigger `/api/cron/process-jobs` once with
      `Authorization: Bearer $CRON_SECRET` and confirm a 200 with real
      `succeeded`/`failed` counts (not an error)
- [ ] Run the GitHub Actions workflow manually once (Actions → "Process
      automation jobs" → "Run workflow") and confirm it succeeds with the
      `SITE_URL`/`CRON_SECRET` secrets set — then leave it on its 5-minute
      schedule and check `/admin/automation` shows activity over time
- [ ] (If using Phase 6) Connect a real Google Sheet, run "Test
      connection", confirm the header row appears
- [ ] (If using Phase 7) Connect a real Facebook Page, run "Test
      connection", publish a listing, confirm a real post appears
- [ ] Confirm the public inquiry/viewing forms reject a 6th submission
      within 10 minutes from the same IP (the Phase 10 rate limiter)

## 7. Ongoing operations

- Check `/admin/automation` periodically for jobs stuck in "Needs
  attention" — each one has a Retry button once the underlying cause
  (an expired Facebook token, a revoked Sheets share, ...) is fixed.
- Check `/reports` for verification compliance — persistently low
  compliance usually means the Phase 8 reminder/escalation cascade isn't
  reaching anyone (dead `assigned_agent_id`s, nobody holding
  `listing.approve`).
- Rotate `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` if either is ever
  exposed (committed, logged, pasted somewhere public) — both are treated
  as full-bypass credentials by the app.

## Known scaling considerations

Called out explicitly rather than silently left for someone to discover:

- **The Phase 10 rate limiter is in-memory, per server process.** Fine on
  a single long-lived server; on Vercel's multi-instance serverless
  functions, each warm instance has its own counters (the effective limit
  multiplies by however many are warm) and a cold start resets it
  silently. Good enough to blunt casual spam, not a hard guarantee. If
  abuse becomes a real problem, replace `src/lib/rate-limit.ts` with a
  shared store — `@upstash/ratelimit` is the standard pairing with Vercel.
- **Reports and the Automation Center's dead-letter/activity feeds fetch
  full RLS-scoped row sets to aggregate/list in application code**,
  except the job-queue status counts (fixed in Phase 10 to use
  count-only queries specifically because `sync_jobs` has no retention
  policy and only grows). Reports' listings/inquiries/viewings aggregates
  are bounded by real inventory size and fine at normal real-estate-org
  scale; revisit with SQL-side `GROUP BY` aggregation if a single
  organization's data grows into the tens of thousands of rows.
- **`automation_events`, `sync_jobs`, and `integration_logs` have no
  archival/retention policy** — they accumulate forever by design (it's
  the audit trail and job history), with pagination (Phase 10) keeping
  any single page load bounded regardless of table size. If storage or
  table bloat becomes a concern at real scale, archive or delete rows
  older than some retention window on a schedule.
