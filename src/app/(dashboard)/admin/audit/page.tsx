import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyPermissions } from '@/lib/auth/permissions';
import { canAny } from '@/lib/auth/permission-utils';
import { Pagination } from '@/components/ui/pagination';
import { DEFAULT_PAGE_SIZE, pageRange, parsePageParam } from '@/lib/pagination';

const RESOURCE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'listing', label: 'Listings' },
  { key: 'profile', label: 'Users' },
  { key: 'inquiry', label: 'Inquiries' },
  { key: 'viewing_request', label: 'Viewings' },
] as const;

type ResourceTab = (typeof RESOURCE_TABS)[number]['key'];

const EVENT_LABELS: Record<string, string> = {
  LISTING_CREATED: 'Listing created',
  LISTING_SUBMITTED: 'Listing submitted',
  LISTING_PUBLISHED: 'Listing published',
  LISTING_CHANGES_REQUESTED: 'Changes requested',
  LISTING_REJECTED: 'Listing rejected',
  LISTING_RESERVED: 'Listing reserved',
  LISTING_RENTED: 'Listing rented',
  LISTING_SOLD: 'Listing sold',
  LISTING_PRICE_CHANGED: 'Price changed',
  LISTING_AGENT_ASSIGNED: 'Agent assigned',
  LISTING_VERIFICATION_DUE: 'Verification reminder sent',
  LISTING_VERIFICATION_OVERDUE: 'Verification escalated',
  LISTING_SHEETS_SYNC_REQUESTED: 'Sheets sync requested',
  LISTING_FACEBOOK_SYNC_REQUESTED: 'Facebook sync requested',
  USER_REGISTERED: 'User registered',
  USER_APPROVED: 'User approved',
  INQUIRY_CREATED: 'Inquiry received',
  VIEWING_REQUESTED: 'Viewing requested',
};

function resourceHref(resourceType: string, resourceId: string | null): string | null {
  if (!resourceId) return null;
  if (resourceType === 'listing') return `/listings/${resourceId}`;
  if (resourceType === 'profile') return `/admin/approvals`;
  return null;
}

export default async function AuditLogPage(props: PageProps<'/admin/audit'>) {
  const searchParams = await props.searchParams;
  const grants = await getMyPermissions();
  if (!canAny(grants, 'audit.view')) redirect('/dashboard');

  const activeTab: ResourceTab = RESOURCE_TABS.some((t) => t.key === searchParams.resource)
    ? (searchParams.resource as ResourceTab)
    : 'all';
  const page = parsePageParam(searchParams.page);
  const [from, to] = pageRange(page);

  const supabase = await createClient();
  let query = supabase
    .from('automation_events')
    .select('id, event_type, resource_type, resource_id, actor_id, payload, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (activeTab !== 'all') query = query.eq('resource_type', activeTab);

  const { data: events, error, count } = await query.range(from, to);

  const actorIds = [...new Set((events ?? []).map((e) => e.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: actors } = actorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] };
  const actorNames = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500">
          Every meaningful change the automation engine recorded — scoped to what you can see (your organization or
          the whole platform, depending on your role).
        </p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 border-b border-slate-200">
          {RESOURCE_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.key === 'all' ? '/admin/audit' : `/admin/audit?resource=${tab.key}`}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {events?.length ? (
          <ul className="divide-y divide-slate-100">
            {events.map((event) => {
              const href = resourceHref(event.resource_type, event.resource_id);
              const label = EVENT_LABELS[event.event_type] ?? event.event_type;
              const propertyName =
                event.payload && typeof event.payload === 'object' && 'property_name' in event.payload
                  ? String((event.payload as Record<string, unknown>).property_name)
                  : null;

              return (
                <li key={event.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    {href ? (
                      <Link href={href} className="font-medium text-slate-900 hover:underline">
                        {label}
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-900">{label}</span>
                    )}
                    {propertyName && <span className="ml-1 text-slate-500">— {propertyName}</span>}
                    <p className="text-xs text-slate-400">
                      {event.actor_id ? (actorNames.get(event.actor_id) ?? 'Unknown user') : 'System'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{new Date(event.created_at).toLocaleString()}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-slate-400">No events in this view.</p>
        )}
      </div>

      <Pagination
        page={page}
        pageSize={DEFAULT_PAGE_SIZE}
        total={count ?? 0}
        buildHref={(p) => (activeTab === 'all' ? `/admin/audit?page=${p}` : `/admin/audit?resource=${activeTab}&page=${p}`)}
      />
    </div>
  );
}
