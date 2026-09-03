import { createClient } from '@/lib/supabase/server';
import { getListingOr404 } from '@/lib/listings/get-listing';
import { ListingForm } from '../listing-form';

export default async function ListingOverviewPage(props: PageProps<'/listings/[id]'>) {
  const { id } = await props.params;
  const listing = await getListingOr404(id);

  const supabase = await createClient();
  const [{ data: amenities }, { data: selected }] = await Promise.all([
    supabase.from('amenities').select('*').order('label'),
    supabase.from('listing_amenities').select('amenity_id').eq('listing_id', id),
  ]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <ListingForm
        listingId={listing.id}
        amenities={amenities ?? []}
        selectedAmenityIds={selected?.map((s) => s.amenity_id) ?? []}
        defaultValues={{
          listing_type: listing.listing_type,
          property_type: listing.property_type,
          property_name: listing.property_name,
          title: listing.title ?? undefined,
          description: listing.description ?? undefined,
          bedrooms: listing.bedrooms?.toString(),
          bathrooms: listing.bathrooms?.toString(),
          has_balcony: listing.has_balcony,
          tower: listing.tower ?? undefined,
          building: listing.building ?? undefined,
          floor: listing.floor ?? undefined,
          unit_number: listing.unit_number ?? undefined,
          floor_area: listing.floor_area?.toString(),
          lot_area: listing.lot_area?.toString(),
          furnishing: listing.furnishing ?? undefined,
          has_parking: listing.has_parking,
          parking_slots: listing.parking_slots?.toString(),
          monthly_rent: listing.monthly_rent?.toString(),
          selling_price: listing.selling_price?.toString(),
          association_dues: listing.association_dues?.toString(),
          security_deposit: listing.security_deposit?.toString(),
          advance: listing.advance?.toString(),
          payment_terms: listing.payment_terms ?? undefined,
          is_negotiable: listing.is_negotiable,
          country: listing.country,
          province: listing.province ?? undefined,
          city: listing.city ?? undefined,
          barangay: listing.barangay ?? undefined,
          full_address: listing.full_address ?? undefined,
          latitude: listing.latitude?.toString(),
          longitude: listing.longitude?.toString(),
        }}
      />
    </div>
  );
}
