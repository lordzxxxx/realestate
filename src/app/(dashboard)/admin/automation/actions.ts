'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ActionResult {
  error?: string;
}

/** The one retry affordance across every integration (Phase 7's
 * retry_sync_job() was built generic on purpose). Permission and
 * dead-letter-only checks both happen inside the RPC itself — this action
 * just surfaces its error message and refreshes the page. */
export async function retrySyncJobAction(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('retry_sync_job', { p_job_id: jobId });
  if (error) return { error: error.message };

  revalidatePath('/admin/automation');
  return {};
}
