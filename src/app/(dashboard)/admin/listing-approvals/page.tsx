import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/auth/permissions';
import { formatCurrency } from '@/lib/listings/constants';
import { ListingApprovalActions } from './listing-approval-actions';

export default async function ListingApprovalsPage() {
  if (!(await hasPermission('listing.approve'))) redirect('/dashboard');

  const supabase = await createClient();

  const { data: pending } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'PENDING_REVIEW')
    .order('submitted_at', { ascending: true });

  const creatorIds = [...new Set((pending ?? []).map((l) => l.created_by).filter((id): id is string => !!id))];
  const { data: creators } =
    creatorIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', creatorIds)
      : { data: [] };
  const creatorNames = new Map((creators ?? []).map((c) => [c.id, c.full_name]));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Listing Approvals</h1>
        <p className="text-sm text-slate-500">
          Properties submitted for review{pending && pending.length > 0 ? ` (${pending.length})` : ''}.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {pending && pending.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {pending.map((listing) => (
              <li key={listing.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link href={`/listings/${listing.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                    {listing.property_name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {listing.listing_number} ·{' '}
                    {formatCurrency(listing.listing_type === 'RENT' ? listing.monthly_rent : listing.selling_price)}
                    {listing.listing_type === 'RENT' && listing.monthly_rent ? '/mo' : ''} · Submitted by{' '}
                    {(listing.created_by && creatorNames.get(listing.created_by)) || 'Unknown'}
                    {listing.submitted_at && ` · ${new Date(listing.submitted_at).toLocaleDateString()}`}
                  </p>
                </div>
                <ListingApprovalActions listingId={listing.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Nothing pending review.</p>
        )}
      </div>
    </div>
  );
}
