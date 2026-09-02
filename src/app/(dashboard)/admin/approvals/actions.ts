'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ProfileStatus } from '@/types/database';

export interface ActionResult {
  error?: string;
}

export async function setProfileStatusAction(
  profileId: string,
  newStatus: ProfileStatus
): Promise<ActionResult> {
  const supabase = await createClient();

  // set_profile_status() is SECURITY DEFINER and re-checks the caller holds
  // the specific permission for this exact transition (user.approve,
  // user.suspend, user.reactivate, or user.archive) — this route has no
  // separate permission gate because that RPC IS the gate.
  const { error } = await supabase.rpc('set_profile_status', {
    p_profile_id: profileId,
    p_new_status: newStatus,
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/approvals');
  return {};
}
