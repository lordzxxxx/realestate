import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Server-side client for Server Components, Server Actions, and Route Handlers.
 * Runs under the caller's session (anon/authenticated), so every query still
 * goes through RLS — this is not a service-role bypass.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component — the middleware refreshes the
            // session cookie instead, so this can be safely ignored.
          }
        },
      },
    }
  );
}

/**
 * Service-role client. Bypasses RLS entirely — never expose it to the client,
 * never call it from code that handles a request without doing its own
 * permission check first. Reserved for: the bootstrap admin script, and
 * background workers (Phase 5) that must act across organizations.
 */
export function createServiceRoleClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createServiceRoleClient must never be called from client code');
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}
