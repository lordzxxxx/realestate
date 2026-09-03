'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { facebookPageConnectionSchema, type FacebookPageConnectionInput } from '@/lib/facebook/schemas';
import { testPageConnection } from '@/lib/facebook/graph';

export interface ActionResult {
  error?: string;
}

async function canManageFacebook(organizationId: string): Promise<boolean> {
  const [manage, facebook] = await Promise.all([
    hasPermission('integrations.manage', organizationId),
    hasPermission('integrations.facebook', organizationId),
  ]);
  return manage || facebook;
}

/** "Save settings": only ever touches page_id/access_token. Deliberately
 * never sets `status`/`page_name` in the same statement — the DB trigger
 * (migration 0025) resets status (and clears the now-stale page_name)
 * whenever the target changes, so a connection is never reported CONNECTED
 * against credentials nobody has actually tested. Run "Test connection"
 * afterward. */
export async function saveFacebookSettingsAction(
  organizationId: string,
  input: FacebookPageConnectionInput
): Promise<ActionResult> {
  const parsed = facebookPageConnectionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  if (!(await canManageFacebook(organizationId))) {
    return { error: 'You do not have permission to manage the Facebook integration.' };
  }

  const session = await getCurrentSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from('facebook_page_connections')
    .update({
      page_id: parsed.data.page_id,
      // Omit entirely when blank, rather than writing an empty string —
      // an untouched token field means "keep the token already saved".
      ...(parsed.data.access_token ? { access_token: parsed.data.access_token } : {}),
      updated_by: session?.userId ?? null,
    })
    .eq('organization_id', organizationId);

  if (error) return { error: error.message };

  revalidatePath(`/organizations/${organizationId}`);
  return {};
}

/** "Test connection": only ever touches status/page_name/last_checked_at/
 * last_error — never page_id/access_token — so it can freely set
 * status=CONNECTED without the reset-on-target-change trigger undoing it.
 * Never reads access_token back to the client: the update below writes it
 * nowhere the client can see, and the fetch that supplies it to
 * testPageConnection() happens entirely server-side in this action. */
export async function testFacebookConnectionAction(organizationId: string): Promise<ActionResult> {
  if (!(await canManageFacebook(organizationId))) {
    return { error: 'You do not have permission to manage the Facebook integration.' };
  }

  const supabase = await createClient();
  const { data: connection, error: fetchError } = await supabase
    .from('facebook_page_connections')
    .select('page_id, access_token')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!connection?.page_id || !connection.access_token) {
    return { error: 'Save a Page ID and access token before testing the connection.' };
  }

  const result = await testPageConnection(connection.page_id, connection.access_token);

  const { error: updateError } = await supabase
    .from('facebook_page_connections')
    .update({
      status: result.ok ? 'CONNECTED' : 'ERROR',
      page_name: result.ok ? (result.pageName ?? null) : null,
      last_checked_at: new Date().toISOString(),
      last_error: result.ok ? null : (result.error ?? 'Unknown error'),
    })
    .eq('organization_id', organizationId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/organizations/${organizationId}`);
  return result.ok ? {} : { error: result.error };
}
