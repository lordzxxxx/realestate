'use server';

import { createClient } from '@/lib/supabase/server';
import { inquirySchema, viewingRequestSchema, type InquiryInput, type ViewingRequestInput } from '@/lib/public/inquiry-schemas';

export interface ActionResult {
  error?: string;
}

export async function createInquiryAction(listingId: string, input: InquiryInput): Promise<ActionResult> {
  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();

  // Deliberately no .select() here: Postgres RLS requires a SELECT-satisfying
  // policy to honor a returned row on INSERT, and anonymous visitors have no
  // SELECT policy on inquiries at all (there is no public "my inquiries"
  // view) — requesting one back would fail with an RLS violation even though
  // the insert itself is allowed. Found via the local smoke test
  // (supabase/seed/997_inquiries_smoke_test.sql).
  const { error } = await supabase.from('inquiries').insert({
    listing_id: listingId,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    message: parsed.data.message || null,
    preferred_contact_method: parsed.data.preferred_contact_method,
  });

  if (error) return { error: 'Could not submit your inquiry. Please try again.' };
  return {};
}

export async function createViewingRequestAction(listingId: string, input: ViewingRequestInput): Promise<ActionResult> {
  const parsed = viewingRequestSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();

  const { error } = await supabase.from('viewing_requests').insert({
    listing_id: listingId,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    preferred_date: parsed.data.preferred_date || null,
    preferred_time: parsed.data.preferred_time || null,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: 'Could not submit your request. Please try again.' };
  return {};
}
