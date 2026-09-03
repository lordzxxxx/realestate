import Link from 'next/link';
import Image from 'next/image';
import { Bed, Bath, Ruler, MapPin } from 'lucide-react';
import { formatCurrency } from '@/lib/listings/constants';
import type { PublicListingCard } from '@/lib/public/queries';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  RESERVED: { label: 'Reserved', className: 'bg-amber-500 text-white' },
  RENTED: { label: 'Rented', className: 'bg-slate-700 text-white' },
  SOLD: { label: 'Sold', className: 'bg-slate-700 text-white' },
  TEMPORARILY_UNAVAILABLE: { label: 'Unavailable', className: 'bg-slate-500 text-white' },
};

export function PropertyCard({ listing }: { listing: PublicListingCard }) {
  const price = listing.listing_type === 'RENT' ? listing.monthly_rent : listing.selling_price;
  const statusBadge = STATUS_BADGE[listing.status];
  const location = [listing.barangay, listing.city].filter(Boolean).join(', ');

  return (
    <Link
      href={`/properties/${listing.slug}`}
      className="group block overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-slate-100">
        {listing.coverImageUrl ? (
          <Image
            src={listing.coverImageUrl}
            alt={listing.property_name}
            fill
            unoptimized
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No photo</div>
        )}
        <span className="absolute left-2 top-2 rounded bg-slate-900/85 px-2 py-0.5 text-xs font-semibold text-white">
          {listing.listing_type === 'RENT' ? 'FOR RENT' : 'FOR SALE'}
        </span>
        {statusBadge && (
          <span className={`absolute right-2 top-2 rounded px-2 py-0.5 text-xs font-semibold ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-slate-900">{listing.property_name}</p>
        <p className="mb-1.5 text-base font-semibold text-slate-900">
          {formatCurrency(price)}
          {listing.listing_type === 'RENT' && price ? <span className="text-xs font-normal text-slate-500">/mo</span> : null}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {listing.bedrooms !== null && (
            <span className="flex items-center gap-1">
              <Bed className="h-3.5 w-3.5" /> {listing.bedrooms}
            </span>
          )}
          {listing.bathrooms !== null && (
            <span className="flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" /> {listing.bathrooms}
            </span>
          )}
          {listing.floor_area !== null && (
            <span className="flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" /> {listing.floor_area}sqm
            </span>
          )}
        </div>
        {location && (
          <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-slate-400">
            <MapPin className="h-3 w-3 shrink-0" /> {location}
          </p>
        )}
      </div>
    </Link>
  );
}
