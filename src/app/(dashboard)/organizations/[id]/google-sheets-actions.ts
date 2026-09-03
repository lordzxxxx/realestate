'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { googleSheetsConnectionSchema, extractSpreadsheetId, type GoogleSheetsConnectionInput } from '@/lib/google/schemas';
import { testSheetsConnection } from '@/lib/google/sheets';

export interface ActionResult {
  error?: string;
}

async function canManageGoogleSheets(organizationId: string): Promise<boolean> {
  const [manage, google] = await Promise.all([
    hasPermission('integrations.manage', organizationId),
    hasPermission('integrations.google', organizationId),
  ]);
  return manage || google;
}

/** "Save settings": only ever touches spreadsheet_id/property_sheet_name.
 * Deliberately never sets `status` in the same statement — the DB trigger
 * (migration 0024) resets status to DISCONNECTED whenever the target
 * changes, so a connection is never reported CONNECTED against a sheet
 * nobody has actually tested yet. Run "Test connection" afterward. */
export async function saveGoogleSheetsSettingsAction(
  organizationId: string,
  input: GoogleSheetsConnectionInput
): Promise<ActionResult> {
  const parsed = googleSheetsConnectionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  if (!(await canManageGoogleSheets(organizationId))) {
    return { error: 'You do not have permission to manage the Google Sheets integration.' };
  }

  const session = await getCurrentSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from('google_sheet_connections')
    .update({
      spreadsheet_id: extractSpreadsheetId(parsed.data.spreadsheet_id),
      property_sheet_name: parsed.data.property_sheet_name,
      updated_by: session?.userId ?? null,
    })
    .eq('organization_id', organizationId);

  if (error) return { error: error.message };

  revalidatePath(`/organizations/${organizationId}`);
  return {};
}

/** "Test connection": only ever touches status/last_checked_at/last_error —
 * never spreadsheet_id/property_sheet_name, so it can freely set
 * status=CONNECTED without the reset-on-target-change trigger undoing it. */
export async function testGoogleSheetsConnectionAction(organizationId: string): Promise<ActionResult> {
  if (!(await canManageGoogleSheets(organizationId))) {
    return { error: 'You do not have permission to manage the Google Sheets integration.' };
  }

  const supabase = await createClient();
  const { data: connection, error: fetchError } = await supabase
    .from('google_sheet_connections')
    .select('spreadsheet_id, property_sheet_name')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!connection?.spreadsheet_id) return { error: 'Save a spreadsheet ID before testing the connection.' };

  const result = await testSheetsConnection(connection.spreadsheet_id, connection.property_sheet_name);

  const { error: updateError } = await supabase
    .from('google_sheet_connections')
    .update({
      status: result.ok ? 'CONNECTED' : 'ERROR',
      last_checked_at: new Date().toISOString(),
      last_error: result.ok ? null : (result.error ?? 'Unknown error'),
    })
    .eq('organization_id', organizationId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/organizations/${organizationId}`);
  return result.ok ? {} : { error: result.error };
}

/** "Sync all now": force-requeues every eligible listing regardless of
 * whether anything changed. Permission and CONNECTED-state are both
 * enforced inside reconcile_google_sheets() itself (migration 0024) — this
 * action just surfaces the RPC's own error message on failure. */
export async function reconcileGoogleSheetsAction(organizationId: string): Promise<ActionResult & { queued?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('reconcile_google_sheets', { p_organization_id: organizationId });

  if (error) return { error: error.message };

  revalidatePath(`/organizations/${organizationId}`);
  return { queued: data ?? 0 };
}
