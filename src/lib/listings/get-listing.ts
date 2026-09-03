import 'server-only';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export type Listing = Database['public']['Tables']['listings']['Row'];

/** Fetches a listing by id, relying on RLS for visibility; 404s if not found/visible. */
export async function getListingOr404(id: string): Promise<Listing> {
  const supabase = await createClient();
  const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  return data;
}
