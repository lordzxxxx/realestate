import { createClient } from '@/lib/supabase/server';
import { InquiryRow } from './inquiry-row';

export default async function InquiriesPage() {
  const supabase = await createClient();

  const { data: inquiries, error } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false });

  const listingIds = [...new Set((inquiries ?? []).map((i) => i.listing_id))];
  const { data: listings } =
    listingIds.length > 0
      ? await supabase.from('listings').select('id, property_name, listing_number').in('id', listingIds)
      : { data: [] };
  const listingLabels = new Map((listings ?? []).map((l) => [l.id, `${l.property_name} (${l.listing_number})`]));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Inquiries</h1>
        <p className="text-sm text-slate-500">Messages from property visitors, routed to the assigned agent.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="space-y-3">
        {inquiries?.map((inquiry) => (
          <InquiryRow key={inquiry.id} inquiry={inquiry} listingLabel={listingLabels.get(inquiry.listing_id) ?? 'Unknown listing'} />
        ))}
        {inquiries?.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            No inquiries yet.
          </p>
        )}
      </div>
    </div>
  );
}
