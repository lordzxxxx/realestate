import { createClient } from '@/lib/supabase/server';
import { LISTING_STATUS_LABELS } from '@/lib/listings/constants';

export default async function ListingHistoryPage(props: PageProps<'/listings/[id]/history'>) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: statusHistory }, { data: revisions }] = await Promise.all([
    supabase
      .from('listing_status_history')
      .select('*')
      .eq('listing_id', id)
      .order('changed_at', { ascending: false }),
    supabase.from('listing_revisions').select('*').eq('listing_id', id).order('version', { ascending: false }),
  ]);

  type Event = { at: string; label: string; detail?: string };

  const statusEvents: Event[] =
    statusHistory?.map((h) => ({
      at: h.changed_at,
      label: h.from_status
        ? `${LISTING_STATUS_LABELS[h.from_status]} → ${LISTING_STATUS_LABELS[h.to_status]}`
        : `Created as ${LISTING_STATUS_LABELS[h.to_status]}`,
      detail: h.note ?? undefined,
    })) ?? [];

  const revisionEvents: Event[] =
    revisions?.map((r) => ({
      at: r.created_at,
      label: `Revision v${r.version} recorded`,
    })) ?? [];

  const events = [...statusEvents, ...revisionEvents].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Activity</h2>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">No activity yet.</p>
      ) : (
        <ol className="space-y-3 border-l border-slate-200 pl-4">
          {events.map((event, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-slate-300" />
              <p className="text-sm text-slate-900">{event.label}</p>
              {event.detail && <p className="text-xs text-slate-500">{event.detail}</p>}
              <p className="text-xs text-slate-400">{new Date(event.at).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
