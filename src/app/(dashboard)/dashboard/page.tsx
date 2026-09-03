import Link from 'next/link';
import { getCurrentSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { LISTING_STATUS_LABELS, LISTING_STATUS_STYLES, formatCurrency } from '@/lib/listings/constants';
import type { ListingStatus } from '@/types/database';

const STALE_VERIFICATION_DAYS = 7;

function isStale(lastVerifiedAt: string | null): boolean {
  if (!lastVerifiedAt) return true;
  const ageMs = Date.now() - new Date(lastVerifiedAt).getTime();
  return ageMs > STALE_VERIFICATION_DAYS * 24 * 60 * 60 * 1000;
}

export default async function DashboardPage() {
  const session = await getCurrentSession();
  const supabase = await createClient();

  const [{ data: statusRows }, { data: recent }] = await Promise.all([
    supabase.from('listings').select('status, listing_type, last_verified_at'),
    supabase.from('listings').select('*').order('created_at', { ascending: false }).limit(5),
  ]);

  const counts: Record<ListingStatus, number> = {
    DRAFT: 0,
    PENDING_REVIEW: 0,
    CHANGES_REQUESTED: 0,
    APPROVED: 0,
    AVAILABLE: 0,
    RESERVED: 0,
    RENTED: 0,
    SOLD: 0,
    TEMPORARILY_UNAVAILABLE: 0,
    REJECTED: 0,
    ARCHIVED: 0,
  };
  let needsVerification = 0;

  for (const row of statusRows ?? []) {
    counts[row.status] += 1;
    if (row.status === 'AVAILABLE' && isStale(row.last_verified_at)) needsVerification += 1;
  }

  const total = (statusRows ?? []).length;
  const rentedOrSold = counts.RENTED + counts.SOLD;

  const stats: { label: string; value: number; href?: string }[] = [
    { label: 'Total Properties', value: total, href: '/listings' },
    { label: 'Available', value: counts.AVAILABLE },
    { label: 'Reserved', value: counts.RESERVED },
    { label: 'Rented / Sold', value: rentedOrSold },
    { label: 'Pending Review', value: counts.PENDING_REVIEW, href: '/admin/listing-approvals' },
    { label: 'Needs Verification', value: needsVerification },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Welcome, {session?.profile.full_name}</h1>
        <p className="text-sm text-slate-500">Account status: {session?.profile.status}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => {
          const content = (
            <>
              <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </>
          );
          return stat.href ? (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
            >
              {content}
            </Link>
          ) : (
            <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-4">
              {content}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent Listings</h2>
          <Link href="/listings" className="text-xs text-slate-500 hover:underline">
            View all
          </Link>
        </div>
        {recent && recent.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {recent.map((listing) => (
              <li key={listing.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <Link href={`/listings/${listing.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                    {listing.property_name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {listing.listing_number} ·{' '}
                    {formatCurrency(listing.listing_type === 'RENT' ? listing.monthly_rent : listing.selling_price)}
                    {listing.listing_type === 'RENT' && listing.monthly_rent ? '/mo' : ''}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded px-2 py-0.5 text-xs font-medium ${LISTING_STATUS_STYLES[listing.status]}`}
                >
                  {LISTING_STATUS_LABELS[listing.status]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No listings yet.</p>
        )}
      </div>

      <p className="text-xs text-slate-400">
        See <Link href="/reports" className="underline hover:text-slate-600">Reports</Link> for inquiries/viewings
        breakdowns and verification compliance, or the{' '}
        <Link href="/admin/automation" className="underline hover:text-slate-600">Automation Center</Link> for
        integration health.
      </p>
    </div>
  );
}
