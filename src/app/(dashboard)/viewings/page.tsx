import { createClient } from '@/lib/supabase/server';
import { ViewingRow } from './viewing-row';

export default async function ViewingsPage() {
  const supabase = await createClient();

  const { data: viewings, error } = await supabase
    .from('viewing_requests')
    .select('*')
    .order('created_at', { ascending: false });

  const listingIds = [...new Set((viewings ?? []).map((v) => v.listing_id))];
  const { data: listings } =
    listingIds.length > 0
      ? await supabase.from('listings').select('id, property_name, listing_number').in('id', listingIds)
      : { data: [] };
  const listingLabels = new Map((listings ?? []).map((l) => [l.id, `${l.property_name} (${l.listing_number})`]));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Viewing Requests</h1>
        <p className="text-sm text-slate-500">Scheduled/requested property viewings, routed to the assigned agent.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="space-y-3">
        {viewings?.map((viewing) => (
          <ViewingRow key={viewing.id} viewing={viewing} listingLabel={listingLabels.get(viewing.listing_id) ?? 'Unknown listing'} />
        ))}
        {viewings?.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            No viewing requests yet.
          </p>
        )}
      </div>
    </div>
  );
}
