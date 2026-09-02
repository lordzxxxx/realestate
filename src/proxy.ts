import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Next.js 16 renamed the `middleware` file convention to `proxy`; this is
// purely a UX redirect layer (keeps unauthenticated visitors off protected
// pages), NOT the security boundary — every server action/route handler
// still enforces its own permission checks, and RLS enforces it again at
// the database layer even if a check here were ever bypassed.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization files.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
