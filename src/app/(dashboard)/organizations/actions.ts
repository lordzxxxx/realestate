'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/auth/session';
import { requirePermission, PermissionDeniedError } from '@/lib/auth/permissions';
import { organizationSchema, organizationSettingsSchema } from '@/lib/organizations/schemas';
import type { OrganizationInput, OrganizationSettingsInput } from '@/lib/organizations/schemas';
import { slugify } from '@/lib/slug';
import type { OrganizationStatus } from '@/types/database';

export interface ActionResult {
  error?: string;
}

async function uniqueSlugFor(name: string): Promise<string> {
  const supabase = await createClient();
  const base = slugify(name) || 'organization';
  let candidate = base;
  let suffix = 2;

  // Small tables, small N — a loop is simpler and clearer than a DB-side
  // uniqueness-resolving function for what is, in practice, an infrequent
  // admin action.
  while (true) {
    const { data } = await supabase.from('organizations').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function createOrganizationAction(input: OrganizationInput): Promise<ActionResult> {
  const parsed = organizationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  try {
    await requirePermission('organization.create');
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { error: 'You do not have permission to create organizations.' };
    throw err;
  }

  const session = await getCurrentSession();
  const supabase = await createClient();
  const slug = await uniqueSlugFor(parsed.data.name);

  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name: parsed.data.name,
      slug,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
      address: parsed.data.address || null,
      created_by: session?.userId ?? null,
    })
    .select('id')
    .single();

  if (error || !data) return { error: error?.message ?? 'Failed to create organization' };

  revalidatePath('/organizations');
  redirect(`/organizations/${data.id}`);
}

export async function updateOrganizationAction(
  organizationId: string,
  input: OrganizationInput
): Promise<ActionResult> {
  const parsed = organizationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  try {
    await requirePermission('organization.edit', organizationId);
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { error: 'You do not have permission to edit this organization.' };
    throw err;
  }

  const session = await getCurrentSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from('organizations')
    .update({
      name: parsed.data.name,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
      address: parsed.data.address || null,
      updated_by: session?.userId ?? null,
    })
    .eq('id', organizationId);

  if (error) return { error: error.message };

  revalidatePath('/organizations');
  revalidatePath(`/organizations/${organizationId}`);
  return {};
}

export async function updateOrganizationSettingsAction(
  organizationId: string,
  input: OrganizationSettingsInput
): Promise<ActionResult> {
  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid settings payload' };

  try {
    await requirePermission('organization.edit', organizationId);
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { error: 'You do not have permission to edit this organization.' };
    throw err;
  }

  const session = await getCurrentSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from('organization_settings')
    .update({ ...parsed.data, updated_by: session?.userId ?? null })
    .eq('organization_id', organizationId);

  if (error) return { error: error.message };

  revalidatePath(`/organizations/${organizationId}`);
  return {};
}

const ORG_STATUS_VALUES: OrganizationStatus[] = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'];

export async function setOrganizationStatusAction(
  organizationId: string,
  status: OrganizationStatus
): Promise<ActionResult> {
  if (!ORG_STATUS_VALUES.includes(status)) return { error: 'Invalid status' };

  try {
    await requirePermission('organization.edit', organizationId);
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { error: 'You do not have permission to change this organization.' };
    throw err;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('organizations')
    .update({ status, archived_at: status === 'ARCHIVED' ? new Date().toISOString() : null })
    .eq('id', organizationId);

  if (error) return { error: error.message };

  revalidatePath('/organizations');
  revalidatePath(`/organizations/${organizationId}`);
  return {};
}
