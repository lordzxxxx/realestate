import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Bed, Bath, Ruler, Building2, MapPin, CheckCircle2 } from 'lucide-react';
import { getPublicListingBySlug, getRelatedListings } from '@/lib/public/queries';
import { formatCurrency, LISTING_STATUS_LABELS, LISTING_STATUS_STYLES } from '@/lib/listings/constants';
import { PropertyGallery } from '@/components/public/property-gallery';
import { PropertyCard } from '@/components/public/property-card';
import { ContactCard } from './contact-card';

export async function generateMetadata(props: PageProps<'/properties/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const listing = await getPublicListingBySlug(slug);
  if (!listing) return { title: 'Property not found' };

  const price = listing.listing_type === 'RENT' ? listing.monthly_rent : listing.selling_price;
  const title = listing.seo_title || `${listing.property_name} — ${listing.listing_type === 'RENT' ? 'For Rent' : 'For Sale'} ${formatCurrency(price)}`;
  const description =
    listing.seo_description ||
    listing.description?.slice(0, 160) ||
    `${listing.property_name} in ${listing.city ?? 'the Philippines'}. ${listing.bedrooms ?? ''} bedroom ${listing.property_type.toLowerCase()}.`;
  const ogImage = listing.images.find((i) => i.is_cover)?.url ?? listing.images[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: `/properties/${listing.slug}` },
    openGraph: {
      title,
      description,
      url: `/properties/${listing.slug}`,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function PropertyDetailsPage(props: PageProps<'/properties/[slug]'>) {
  const { slug } = await props.params;
  const listing = await getPublicListingBySlug(slug);
  if (!listing) notFound();

  const related = await getRelatedListings(listing);
  const price = listing.listing_type === 'RENT' ? listing.monthly_rent : listing.selling_price;
  const location = [listing.barangay, listing.city, listing.province].filter(Boolean).join(', ');
  const amenities = listing.amenities.filter((a) => a.kind === 'AMENITY');
  const nearby = listing.amenities.filter((a) => a.kind === 'NEARBY');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>{' '}
        /{' '}
        <Link href="/properties" className="hover:underline">
          Properties
        </Link>{' '}
        / <span className="text-slate-700">{listing.property_name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PropertyGallery images={listing.images} propertyName={listing.property_name} />

          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                {listing.listing_type === 'RENT' ? 'FOR RENT' : 'FOR SALE'}
              </span>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${LISTING_STATUS_STYLES[listing.status]}`}>
                {LISTING_STATUS_LABELS[listing.status]}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">{listing.property_name}</h1>
            {location && (
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <MapPin className="h-4 w-4" /> {location}
              </p>
            )}
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {formatCurrency(price)}
              {listing.listing_type === 'RENT' && price && <span className="text-sm font-normal text-slate-500">/month</span>}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4">
            <Stat icon={Bed} label="Bedrooms" value={listing.bedrooms ?? '—'} />
            <Stat icon={Bath} label="Bathrooms" value={listing.bathrooms ?? '—'} />
            <Stat icon={Ruler} label="Floor Area" value={listing.floor_area ? `${listing.floor_area} sqm` : '—'} />
            <Stat icon={Building2} label="Furnishing" value={listing.furnishing?.replace('_', ' ') ?? '—'} />
          </div>

          {listing.description && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Description</h2>
              <p className="whitespace-pre-line text-sm text-slate-600">{listing.description}</p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
            <DetailRow label="Listing ID" value={listing.listing_number} />
            {listing.tower && <DetailRow label="Tower" value={listing.tower} />}
            {listing.building && <DetailRow label="Building" value={listing.building} />}
            {listing.floor && <DetailRow label="Floor" value={listing.floor} />}
            {listing.unit_number && <DetailRow label="Unit" value={listing.unit_number} />}
            {listing.payment_terms && <DetailRow label="Terms" value={listing.payment_terms} />}
            {listing.has_parking && <DetailRow label="Parking" value={listing.parking_slots ? `${listing.parking_slots} slot(s)` : 'Yes'} />}
            {listing.is_negotiable && <DetailRow label="Price" value="Negotiable" />}
            {listing.last_verified_at && (
              <DetailRow label="Last Verified" value={new Date(listing.last_verified_at).toLocaleDateString()} />
            )}
          </dl>

          {amenities.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {amenities.map((a) => (
                  <span key={a.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {a.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {nearby.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Nearby</h2>
              <div className="flex flex-wrap gap-2">
                {nearby.map((a) => (
                  <span key={a.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {a.label}
                    {a.distance_note ? ` · ${a.distance_note}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <ContactCard listingId={listing.id} />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Related Properties</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <PropertyCard key={r.id} listing={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Bed; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-slate-400" />
      <div>
        <p className="text-sm font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
