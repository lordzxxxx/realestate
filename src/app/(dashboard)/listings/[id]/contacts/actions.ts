'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/auth/session';
import { listingContactSchema, type ListingContactInput } from '@/lib/listings/contact-schema';

export interface ActionResult {
  error?: string;
}

export async function createListingContactAction(
  listingId: string,
  input: ListingContactInput
): Promise<ActionResult> {
  const parsed = listingContactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const session = await getCurrentSession();
  const supabase = await createClient();

  const { email, phone, messenger, company, viewing_instructions, access_instructions, internal_notes, commission_info, ...rest } =
    parsed.data;

  const { error } = await supabase.from('listing_contacts').insert({
    listing_id: listingId,
    ...rest,
    email: email || null,
    phone: phone || null,
    messenger: messenger || null,
    company: company || null,
    viewing_instructions: viewing_instructions || null,
    access_instructions: access_instructions || null,
    internal_notes: internal_notes || null,
    commission_info: commission_info || null,
    created_by: session?.userId ?? null,
    updated_by: session?.userId ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/listings/${listingId}/contacts`);
  return {};
}

export async function updateListingContactAction(
  listingId: string,
  contactId: string,
  input: ListingContactInput
): Promise<ActionResult> {
  const parsed = listingContactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const session = await getCurrentSession();
  const supabase = await createClient();

  const { email, phone, messenger, company, viewing_instructions, access_instructions, internal_notes, commission_info, ...rest } =
    parsed.data;

  const { error } = await supabase
    .from('listing_contacts')
    .update({
      ...rest,
      email: email || null,
      phone: phone || null,
      messenger: messenger || null,
      company: company || null,
      viewing_instructions: viewing_instructions || null,
      access_instructions: access_instructions || null,
      internal_notes: internal_notes || null,
      commission_info: commission_info || null,
      updated_by: session?.userId ?? null,
    })
    .eq('id', contactId);

  if (error) return { error: error.message };

  revalidatePath(`/listings/${listingId}/contacts`);
  return {};
}

export async function deleteListingContactAction(listingId: string, contactId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('listing_contacts').delete().eq('id', contactId);
  if (error) return { error: error.message };

  revalidatePath(`/listings/${listingId}/contacts`);
  return {};
}
