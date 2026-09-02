import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export interface CurrentSession {
  userId: string;
  email: string;
  profile: Profile;
}

/**
 * Resolves the logged-in user's own profile. Relies on the profiles_select
 * RLS policy (id = auth.uid()), so it never leaks another user's row.
 * Returns null when there is no session, or when the auth user exists but the
 * profile row hasn't been created yet (should not happen outside a race with
 * the signup trigger).
 */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  if (error || !profile) return null;

  return { userId: user.id, email: user.email ?? profile.email, profile };
}
