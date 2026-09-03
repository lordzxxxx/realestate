'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { listingFormSchema, type ListingInput } from '@/lib/listings/schemas';
import { LISTING_TYPES, PROPERTY_TYPES, FURNISHING_TYPES } from '@/lib/listings/constants';
import { createListingAction, updateListingAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, FieldError } from '@/components/ui/input';
import type { Database } from '@/types/database';

type Amenity = Database['public']['Tables']['amenities']['Row'];

export function ListingForm({
  listingId,
  defaultValues,
  amenities,
  selectedAmenityIds = [],
}: {
  listingId?: string;
  defaultValues?: Partial<ListingInput>;
  amenities: Amenity[];
  selectedAmenityIds?: string[];
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ListingInput>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: {
      listing_type: 'RENT',
      property_type: 'CONDOMINIUM',
      country: 'Philippines',
      has_balcony: false,
      has_parking: false,
      is_negotiable: false,
      amenity_ids: selectedAmenityIds,
      ...defaultValues,
    },
  });

  const onSubmit = async (data: ListingInput) => {
    setServerError(null);
    setSaved(false);
    const result = listingId ? await updateListingAction(listingId, data) : await createListingAction(data);
    if (result?.error) setServerError(result.error);
    else if (listingId) setSaved(true);
  };

  const amenityList = amenities.filter((a) => a.kind === 'AMENITY');
  const nearbyList = amenities.filter((a) => a.kind === 'NEARBY');

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      <Section title="Listing Information">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="listing_type">Listing type</Label>
            <Select id="listing_type" {...register('listing_type')}>
              {LISTING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="property_type">Property type</Label>
            <Select id="property_type" {...register('property_type')}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="property_name">Property name</Label>
          <Input id="property_name" placeholder="e.g. Six Senses" {...register('property_name')} />
          <FieldError message={errors.property_name?.message} />
        </div>
        <div>
          <Label htmlFor="title">Listing title (optional)</Label>
          <Input id="title" {...register('title')} />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            rows={4}
            className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            {...register('description')}
          />
        </div>
      </Section>

      <Section title="Unit Details">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="bedrooms">Bedrooms</Label>
            <Input id="bedrooms" type="number" min={0} {...register('bedrooms')} />
          </div>
          <div>
            <Label htmlFor="bathrooms">Bathrooms</Label>
            <Input id="bathrooms" type="number" min={0} step={0.5} {...register('bathrooms')} />
          </div>
          <div>
            <Label htmlFor="furnishing">Furnishing</Label>
            <Select id="furnishing" {...register('furnishing')}>
              <option value="">Not specified</option>
              {FURNISHING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="tower">Tower</Label>
            <Input id="tower" {...register('tower')} />
          </div>
          <div>
            <Label htmlFor="building">Building</Label>
            <Input id="building" {...register('building')} />
          </div>
          <div>
            <Label htmlFor="floor">Floor</Label>
            <Input id="floor" {...register('floor')} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="unit_number">Unit number</Label>
            <Input id="unit_number" {...register('unit_number')} />
          </div>
          <div>
            <Label htmlFor="floor_area">Floor area (sqm)</Label>
            <Input id="floor_area" type="number" min={0} step={0.01} {...register('floor_area')} />
          </div>
          <div>
            <Label htmlFor="lot_area">Lot area (sqm)</Label>
            <Input id="lot_area" type="number" min={0} step={0.01} {...register('lot_area')} />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('has_balcony')} />
            Balcony
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('has_parking')} />
            Parking
          </label>
          <div className="flex items-center gap-2">
            <Label htmlFor="parking_slots" className="mb-0">
              Slots
            </Label>
            <Input id="parking_slots" type="number" min={0} className="w-20" {...register('parking_slots')} />
          </div>
        </div>
      </Section>

      <Section title="Price">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="monthly_rent">Monthly rent</Label>
            <Input id="monthly_rent" type="number" min={0} {...register('monthly_rent')} />
            <FieldError message={errors.monthly_rent?.message} />
          </div>
          <div>
            <Label htmlFor="selling_price">Selling price</Label>
            <Input id="selling_price" type="number" min={0} {...register('selling_price')} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="association_dues">Association dues</Label>
            <Input id="association_dues" type="number" min={0} {...register('association_dues')} />
          </div>
          <div>
            <Label htmlFor="security_deposit">Security deposit</Label>
            <Input id="security_deposit" type="number" min={0} {...register('security_deposit')} />
          </div>
          <div>
            <Label htmlFor="advance">Advance</Label>
            <Input id="advance" type="number" min={0} {...register('advance')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="payment_terms">Payment terms</Label>
            <Input id="payment_terms" placeholder="e.g. 1+2" {...register('payment_terms')} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('is_negotiable')} />
            Negotiable
          </label>
        </div>
      </Section>

      <Section title="Location">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="province">Province</Label>
            <Input id="province" {...register('province')} />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register('city')} />
          </div>
          <div>
            <Label htmlFor="barangay">Barangay / Area</Label>
            <Input id="barangay" {...register('barangay')} />
          </div>
        </div>
        <div>
          <Label htmlFor="full_address">Full address</Label>
          <Input id="full_address" {...register('full_address')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="latitude">Latitude</Label>
            <Input id="latitude" type="number" step="any" {...register('latitude')} />
          </div>
          <div>
            <Label htmlFor="longitude">Longitude</Label>
            <Input id="longitude" type="number" step="any" {...register('longitude')} />
          </div>
        </div>
      </Section>

      <Section title="Amenities">
        <CheckboxGrid items={amenityList} register={register} />
      </Section>

      <Section title="Nearby Locations">
        <CheckboxGrid items={nearbyList} register={register} />
      </Section>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {saved && <p className="text-sm text-emerald-600">Saved.</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : listingId ? 'Save changes' : 'Create draft'}
      </Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-sm font-semibold text-slate-900">{title}</legend>
      {children}
    </fieldset>
  );
}

function CheckboxGrid({
  items,
  register,
}: {
  items: Amenity[];
  register: ReturnType<typeof useForm<ListingInput>>['register'];
}) {
  if (items.length === 0) return <p className="text-sm text-slate-400">None configured.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <label key={item.id} className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            value={item.id}
            className="h-4 w-4 rounded border-slate-300"
            {...register('amenity_ids')}
          />
          {item.label}
        </label>
      ))}
    </div>
  );
}
