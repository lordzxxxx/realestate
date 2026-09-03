'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/auth/session';

export interface ActionResult {
  error?: string;
}

export async function registerListingImageAction(
  listingId: string,
  storagePath: string
): Promise<ActionResult & { id?: string }> {
  const session = await getCurrentSession();
  const supabase = await createClient();

  const { count } = await supabase
    .from('listing_images')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId);

  const { data, error } = await supabase
    .from('listing_images')
    .insert({
      listing_id: listingId,
      storage_path: storagePath,
      sort_order: count ?? 0,
      is_cover: (count ?? 0) === 0,
      created_by: session?.userId ?? null,
    })
    .select('id')
    .single();

  if (error || !data) return { error: error?.message ?? 'Failed to save image' };

  revalidatePath(`/listings/${listingId}/images`);
  return { id: data.id };
}

export async function reorderListingImagesAction(
  listingId: string,
  orderedImageIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient();

  const results = await Promise.all(
    orderedImageIds.map((id, index) =>
      supabase.from('listing_images').update({ sort_order: index }).eq('id', id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath(`/listings/${listingId}/images`);
  return {};
}

export async function setCoverImageAction(listingId: string, imageId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Must unset the existing cover BEFORE setting the new one — the partial
  // unique index (one cover per listing) would reject having two rows with
  // is_cover=true at once if done in the other order.
  const { error: unsetError } = await supabase
    .from('listing_images')
    .update({ is_cover: false })
    .eq('listing_id', listingId)
    .eq('is_cover', true);
  if (unsetError) return { error: unsetError.message };

  const { error: setError } = await supabase.from('listing_images').update({ is_cover: true }).eq('id', imageId);
  if (setError) return { error: setError.message };

  revalidatePath(`/listings/${listingId}/images`);
  return {};
}

export async function updateListingImageAction(
  listingId: string,
  imageId: string,
  fields: { caption?: string; alt_text?: string }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('listing_images')
    .update({ caption: fields.caption || null, alt_text: fields.alt_text || null })
    .eq('id', imageId);
  if (error) return { error: error.message };

  revalidatePath(`/listings/${listingId}/images`);
  return {};
}

export async function deleteListingImageAction(
  listingId: string,
  imageId: string,
  storagePath: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: storageError } = await supabase.storage.from('listing-images').remove([storagePath]);
  if (storageError) return { error: storageError.message };

  const { error } = await supabase.from('listing_images').delete().eq('id', imageId);
  if (error) return { error: error.message };

  revalidatePath(`/listings/${listingId}/images`);
  return {};
}
