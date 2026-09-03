import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LISTING_STATUS_LABELS, LISTING_STATUS_STYLES, formatCurrency } from '@/lib/listings/constants';
import { QuickStatusActions } from './quick-status-actions';
import type { Listing } from '@/lib/listings/get-listing';

const STALE_VERIFICATION_DAYS = 7;

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'rented_sold', label: 'Rented / Sold' },
  { key: 'needs_verification', label: 'Needs Verification' },
  { key: 'pending', label: 'Pending Review' },
  { key: 'draft', label: 'Drafts' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function isStale(lastVerifiedAt: string | null): boolean {
  if (!lastVerifiedAt) return true;
  return Date.now() - new Date(lastVerifiedAt).getTime() > STALE_VERIFICATION_DAYS * 24 * 60 * 60 * 1000;
}

export default async function ListingsPage(props: PageProps<'/listings'>) {
  const searchParams = await props.searchParams;
  const activeTab: TabKey = TABS.some((t) => t.key === searchParams.status) ? (searchParams.status as TabKey) : 'all';

  const supabase = await createClient();
  let query = supabase.from('listings').select('*').order('updated_at', { ascending: false });

  if (activeTab === 'available') query = query.eq('status', 'AVAILABLE');
  else if (activeTab === 'reserved') query = query.eq('status', 'RESERVED');
  else if (activeTab === 'rented_sold') query = query.in('status', ['RENTED', 'SOLD']);
  else if (activeTab === 'pending') query = query.eq('status', 'PENDING_REVIEW');
  else if (activeTab === 'draft') query = query.eq('status', 'DRAFT');
  else if (activeTab === 'needs_verification') {
    // This route is plain dynamic SSR (no 'use cache'/dynamicIO opted in —
    // confirmed dynamic in the build output), so a request-time clock read
    // is exactly correct here, not a caching hazard the purity rule guards
    // against.
    // eslint-disable-next-line react-hooks/purity -- see comment above
    const cutoff = new Date(Date.now() - STALE_VERIFICATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    query = query.eq('status', 'AVAILABLE').or(`last_verified_at.is.null,last_verified_at.lt.${cutoff}`);
  }

  const { data: listings, error } = await query;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Listings</h1>
          <p className="text-sm text-slate-500">Properties you created, are assigned to, or can view for your organization.</p>
        </div>
        <Link href="/listings/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Add Property
          </Button>
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.key === 'all' ? '/listings' : `/listings?status=${tab.key}`}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="space-y-2">
        {listings?.map((listing: Listing) => (
          <div
            key={listing.id}
            className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/listings/${listing.id}`} className="font-medium text-slate-900 hover:underline">
                  {listing.property_name}
                </Link>
                <span
                  className={`inline-flex shrink-0 rounded px-2 py-0.5 text-xs font-medium ${LISTING_STATUS_STYLES[listing.status]}`}
                >
                  {LISTING_STATUS_LABELS[listing.status]}
                </span>
                {listing.status === 'AVAILABLE' && isStale(listing.last_verified_at) && (
                  <span className="inline-flex shrink-0 rounded bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                    Needs Verification
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {listing.listing_number} ·{' '}
                {formatCurrency(listing.listing_type === 'RENT' ? listing.monthly_rent : listing.selling_price)}
                {listing.listing_type === 'RENT' && listing.monthly_rent ? '/mo' : ''}
              </p>
            </div>
            <QuickStatusActions listingId={listing.id} status={listing.status} listingType={listing.listing_type} />
          </div>
        ))}
        {listings?.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            No listings in this view.
          </p>
        )}
      </div>
    </div>
  );
}
