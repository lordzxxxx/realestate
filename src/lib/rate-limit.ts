import 'server-only';
import { headers } from 'next/headers';

// Phase 10 (Production Security): a lightweight, no-new-infra limiter for
// the anon-facing public forms (inquiry/viewing request) — today anyone
// can submit either with no limit at all. Deliberately in-memory rather
// than a Redis/Upstash-backed one: simple, zero additional setup, and
// enough to stop a casual script.
//
// Known limitation, stated plainly rather than glossed over: this state is
// per server process. A single long-lived server (a VM, a container) is
// fine. On a multi-instance serverless deployment (Vercel functions with
// several concurrent instances, each recycled on its own schedule) each
// instance has its own counters, so the *effective* limit multiplies by
// however many instances happen to be warm, and a cold start silently
// resets it. Good enough to blunt casual spam; if this ever needs to be a
// hard guarantee, replace this module with a shared store (Upstash Redis's
// `@upstash/ratelimit` is the standard pairing with Vercel) — see the
// deployment runbook.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Sweeps expired entries opportunistically (on the same call path that
// already touches the map) rather than running a background timer, so this
// module has no lifecycle to manage — it just stays small over time.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/** Fixed-window counter: `limit` requests per `windowMs`, per `key`. */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(k);
    }
    lastCleanup = now;
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true };
}

/** Best-effort client IP from proxy headers — trustworthy enough to key a
 * spam-blunting rate limit (not an auth decision), not trustworthy enough
 * for anything security-critical (a client can freely spoof these on a
 * direct request; only the outermost proxy's own append is authoritative,
 * and Vercel's is). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return h.get('x-real-ip') ?? 'unknown';
}
