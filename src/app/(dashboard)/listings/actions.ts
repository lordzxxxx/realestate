'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { listingServerSchema, type ListingInput } from '@/lib/listings/schemas';
import type { ListingStatus } from '@/types/database';

export interface ActionResult {
  error?: string;
}

async function syncListingAmenities(listingId: string, amenityIds: string[]) {
  const supabase = await createClient();
  await supabase.from('listing_amenities').delete().eq('listing_id', listingId);
  if (amenityIds.length > 0) {
    await supabase
      .from('listing_amenities')
      .insert(amenityIds.map((amenity_id) => ({ listing_id: listingId, amenity_id })));
  }
}

export async function createListingAction(input: ListingInput): Promise<ActionResult> {
  const parsed = listingServerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const session = await getCurrentSession();
  if (!session) return { error: 'Not signed in' };
  if (!session.profile.organization_id) {
    return { error: 'Your account is not linked to an organization yet. Ask an admin to assign one.' };
  }
  if (!(await hasPermission('listing.create', session.profile.organization_id))) {
    return { error: 'You do not have permission to create listings.' };
  }

  const { amenity_ids, ...fields } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('listings')
    .insert({
      ...fields,
      organization_id: session.profile.organization_id,
      created_by: session.userId,
    })
    .select('id')
    .single();

  if (error || !data) return { error: error?.message ?? 'Failed to create listing' };

  if (amenity_ids.length > 0) await syncListingAmenities(data.id, amenity_ids);

  revalidatePath('/listings');
  redirect(`/listings/${data.id}`);
}

export async function updateListingAction(listingId: string, input: ListingInput): Promise<ActionResult> {
  const parsed = listingServerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const session = await getCurrentSession();
  if (!session) return { error: 'Not signed in' };

  const { amenity_ids, ...fields } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from('listings')
    .update({ ...fields, updated_by: session.userId })
    .eq('id', listingId);

  if (error) return { error: error.message };

  await syncListingAmenities(listingId, amenity_ids);

  revalidatePath('/listings');
  revalidatePath(`/listings/${listingId}`);
  return {};
}

export async function submitListingAction(listingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_listing', { p_listing_id: listingId });
  if (error) return { error: error.message };
  revalidatePath(`/listings/${listingId}`);
  revalidatePath('/listings');
  return {};
}

export async function setListingStatusAction(
  listingId: string,
  newStatus: ListingStatus,
  note?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_listing_status', {
    p_listing_id: listingId,
    p_new_status: newStatus,
    p_note: note ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/listings/${listingId}`);
  revalidatePath('/listings');
  return {};
}

export async function approveAndPublishAction(listingId: string, note?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_and_publish_listing', {
    p_listing_id: listingId,
    p_note: note ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/listings/${listingId}`);
  revalidatePath('/listings');
  return {};
}

/** Phase 8's "Confirm still available" quick action — resets the
 * verification reminder clock without touching status. */
export async function verifyListingAction(listingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('verify_listing', { p_listing_id: listingId });
  if (error) return { error: error.message };
  revalidatePath(`/listings/${listingId}`);
  revalidatePath('/listings');
  return {};
}

export async function assignAgentAction(listingId: string, agentId: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('assign_listing_agent', {
    p_listing_id: listingId,
    p_agent_id: agentId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/listings/${listingId}`);
  return {};
}
