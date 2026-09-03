import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { LISTING_STATUS_LABELS, LISTING_STATUS_STYLES, formatCurrency } from '@/lib/listings/constants';

export default async function ListingsPage() {
  const supabase = await createClient();
  const { data: listings, error } = await supabase
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
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

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Listing</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Price</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {listings?.map((listing) => (
              <tr key={listing.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/listings/${listing.id}`} className="font-medium text-slate-900 hover:underline">
                    {listing.property_name}
                  </Link>
                  <p className="text-xs text-slate-400">{listing.listing_number}</p>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{listing.listing_type === 'RENT' ? 'For Rent' : 'For Sale'}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {formatCurrency(listing.listing_type === 'RENT' ? listing.monthly_rent : listing.selling_price)}
                  {listing.listing_type === 'RENT' && listing.monthly_rent ? '/mo' : ''}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${LISTING_STATUS_STYLES[listing.status]}`}
                  >
                    {LISTING_STATUS_LABELS[listing.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{new Date(listing.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {listings?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No listings yet. Click &ldquo;Add Property&rdquo; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
