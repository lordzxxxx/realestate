import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { PropertySearchFilters } from './filters';

type Listing = Database['public']['Tables']['listings']['Row'];

export interface PublicListingCard extends Listing {
  coverImageUrl: string | null;
}

const PUBLICLY_VISIBLE_STATUSES: Listing['status'][] = [
  'AVAILABLE',
  'RESERVED',
  'RENTED',
  'SOLD',
  'TEMPORARILY_UNAVAILABLE',
];

/**
 * Mirrors the SQL is_publicly_visible() function (migration 0017).
 *
 * Needed because getPublicListingBySlug queries by slug without a status
 * filter and relies on RLS for visibility — but RLS is evaluated per
 * session, not per "is this genuinely public". A logged-in staff member
 * browsing the public site with their own read_own/read_organization access
 * would otherwise have their own DRAFT/PENDING_REVIEW listing render on the
 * public property page, since RLS legitimately lets them see it. This check
 * makes the public template itself refuse to render anything that isn't
 * actually publicly visible, regardless of who's asking.
 */
function isPubliclyVisible(listing: Pick<Listing, 'status' | 'website_enabled'>): boolean {
  return listing.website_enabled && PUBLICLY_VISIBLE_STATUSES.includes(listing.status);
}

const CARD_COLUMNS =
  'id, slug, listing_number, listing_type, property_type, property_name, title, bedrooms, bathrooms, ' +
  'floor_area, furnishing, monthly_rent, selling_price, city, province, barangay, status, last_verified_at, ' +
  'created_at, organization_id';

async function withCoverImages<T extends { id: string }>(rows: T[]): Promise<(T & { coverImageUrl: string | null })[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const { data: images } = await supabase
    .from('listing_images')
    .select('listing_id, storage_path')
    .in(
      'listing_id',
      rows.map((r) => r.id)
    )
    .eq('is_cover', true);

  const coverByListing = new Map<string, string>();
  for (const img of images ?? []) {
    coverByListing.set(img.listing_id, supabase.storage.from('listing-images').getPublicUrl(img.storage_path).data.publicUrl);
  }

  return rows.map((row) => ({ ...row, coverImageUrl: coverByListing.get(row.id) ?? null }));
}

export async function searchPublicListings(
  filters: PropertySearchFilters,
  { limit = 24, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<{ listings: PublicListingCard[]; count: number }> {
  const supabase = await createClient();

  let q = supabase.from('listings').select(CARD_COLUMNS, { count: 'exact' });

  q = filters.availableOnly ? q.eq('status', 'AVAILABLE') : q.in('status', ['AVAILABLE', 'RESERVED']);
  if (filters.listingType) q = q.eq('listing_type', filters.listingType);
  if (filters.propertyType) q = q.eq('property_type', filters.propertyType);
  if (filters.city) q = q.ilike('city', `%${filters.city}%`);
  if (filters.bedrooms !== undefined) q = q.gte('bedrooms', filters.bedrooms);
  if (filters.bathrooms !== undefined) q = q.gte('bathrooms', filters.bathrooms);
  if (filters.furnishing) q = q.eq('furnishing', filters.furnishing);
  if (filters.q) q = q.ilike('property_name', `%${filters.q}%`);

  const priceColumn = filters.listingType === 'SALE' ? 'selling_price' : 'monthly_rent';
  if (filters.minPrice !== undefined) q = q.gte(priceColumn, filters.minPrice);
  if (filters.maxPrice !== undefined) q = q.lte(priceColumn, filters.maxPrice);

  if (filters.sort === 'price_low') q = q.order(priceColumn, { ascending: true, nullsFirst: false });
  else if (filters.sort === 'price_high') q = q.order(priceColumn, { ascending: false, nullsFirst: false });
  else if (filters.sort === 'recently_verified') q = q.order('last_verified_at', { ascending: false, nullsFirst: false });
  else q = q.order('created_at', { ascending: false });

  const { data, count, error } = await q.range(offset, offset + limit - 1);
  if (error) throw error;

  const listings = await withCoverImages((data ?? []) as unknown as Listing[]);
  return { listings: listings as PublicListingCard[], count: count ?? 0 };
}

export async function getFeaturedListings(limit = 6): Promise<PublicListingCard[]> {
  const { listings } = await searchPublicListings({ sort: 'newest' }, { limit });
  return listings;
}

export interface PublicListingDetail extends Listing {
  images: { id: string; url: string; alt_text: string | null; caption: string | null; is_cover: boolean }[];
  amenities: { id: string; key: string; label: string; kind: 'AMENITY' | 'NEARBY'; distance_note: string | null }[];
}

export async function getPublicListingBySlug(slug: string): Promise<PublicListingDetail | null> {
  const supabase = await createClient();

  const { data: listing } = await supabase.from('listings').select('*').eq('slug', slug).maybeSingle();
  if (!listing || !isPubliclyVisible(listing)) return null;

  const [{ data: images }, { data: listingAmenities }] = await Promise.all([
    supabase
      .from('listing_images')
      .select('id, storage_path, alt_text, caption, is_cover')
      .eq('listing_id', listing.id)
      .order('sort_order'),
    supabase.from('listing_amenities').select('amenity_id, distance_note').eq('listing_id', listing.id),
  ]);

  const amenityIds = (listingAmenities ?? []).map((a) => a.amenity_id);
  const { data: amenityRows } =
    amenityIds.length > 0 ? await supabase.from('amenities').select('*').in('id', amenityIds) : { data: [] };
  const amenityById = new Map((amenityRows ?? []).map((a) => [a.id, a]));

  return {
    ...listing,
    images: (images ?? []).map((img) => ({
      id: img.id,
      url: supabase.storage.from('listing-images').getPublicUrl(img.storage_path).data.publicUrl,
      alt_text: img.alt_text,
      caption: img.caption,
      is_cover: img.is_cover,
    })),
    amenities: (listingAmenities ?? [])
      .map((la) => {
        const amenity = amenityById.get(la.amenity_id);
        if (!amenity) return null;
        return { id: amenity.id, key: amenity.key, label: amenity.label, kind: amenity.kind, distance_note: la.distance_note };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null),
  };
}

export async function getRelatedListings(listing: Listing, limit = 4): Promise<PublicListingCard[]> {
  const supabase = await createClient();
  let q = supabase
    .from('listings')
    .select(CARD_COLUMNS)
    .in('status', ['AVAILABLE', 'RESERVED'])
    .eq('property_type', listing.property_type)
    .neq('id', listing.id)
    .limit(limit);

  if (listing.city) q = q.eq('city', listing.city);

  const { data } = await q;
  return withCoverImages((data ?? []) as unknown as Listing[]) as Promise<PublicListingCard[]>;
}
