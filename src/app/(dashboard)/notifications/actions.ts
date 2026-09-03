'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/auth/session';

export interface ActionResult {
  error?: string;
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) return { error: error.message };
  revalidatePath('/notifications');
  return {};
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: 'Not signed in' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', session.userId)
    .is('read_at', null);

  if (error) return { error: error.message };
  revalidatePath('/notifications');
  return {};
}
