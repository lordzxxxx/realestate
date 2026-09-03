'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ViewingStatus } from '@/types/database';

export interface ActionResult {
  error?: string;
}

export async function updateViewingAction(
  viewingId: string,
  fields: { status?: ViewingStatus; notes?: string; assigned_agent_id?: string | null }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('viewing_requests').update(fields).eq('id', viewingId);
  if (error) return { error: error.message };

  revalidatePath('/viewings');
  return {};
}
