import { getListingOr404 } from '@/lib/listings/get-listing';
import { LISTING_STATUS_LABELS, LISTING_STATUS_STYLES, formatCurrency } from '@/lib/listings/constants';
import { ListingTabs } from './listing-tabs';
import { ListingStatusPanel } from './listing-status-panel';

export default async function ListingDetailLayout({
  children,
  params,
}: LayoutProps<'/listings/[id]'>) {
  const { id } = await params;
  const listing = await getListingOr404(id);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{listing.property_name}</h1>
          <span
            className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${LISTING_STATUS_STYLES[listing.status]}`}
          >
            {LISTING_STATUS_LABELS[listing.status]}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          {listing.listing_number} · {formatCurrency(listing.listing_type === 'RENT' ? listing.monthly_rent : listing.selling_price)}
          {listing.listing_type === 'RENT' && listing.monthly_rent ? '/mo' : ''}
        </p>
      </div>

      <ListingStatusPanel listing={listing} />

      <ListingTabs listingId={listing.id} />

      {children}
    </div>
  );
}
