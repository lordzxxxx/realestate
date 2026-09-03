'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { InquiryStatus } from '@/types/database';

export interface ActionResult {
  error?: string;
}

export async function updateInquiryAction(
  inquiryId: string,
  fields: { status?: InquiryStatus; notes?: string; assigned_agent_id?: string | null }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('inquiries').update(fields).eq('id', inquiryId);
  if (error) return { error: error.message };

  revalidatePath('/inquiries');
  return {};
}
