import { z } from 'zod';

const LISTING_TYPE_VALUES = ['RENT', 'SALE'] as const;
const PROPERTY_TYPE_VALUES = [
  'CONDOMINIUM',
  'HOUSE',
  'HOUSE_AND_LOT',
  'APARTMENT',
  'COMMERCIAL',
  'OFFICE',
  'LOT',
  'ROOM',
  'BEDSPACE',
  'TOWNHOUSE',
  'WAREHOUSE',
  'OTHER',
] as const;
const FURNISHING_VALUES = ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'] as const;

/**
 * Client-facing schema — used only for `useForm`/`zodResolver`, so its shape
 * must match real DOM values exactly: a native `<input type="number">`
 * without `valueAsNumber` yields a *string* into react-hook-form's state,
 * never a number. Validation here is UX-only (required fields, basic shape);
 * `listingServerSchema` below is the actual data/authorization boundary and
 * does the real coercion + normalization server-side.
 *
 * (A single schema using z.preprocess/transform for that coercion can't work
 * here: preprocess collapses the field's input type to `unknown`, which then
 * can't satisfy a single `useForm<ListingInput>()` type parameter shared
 * between the resolver's input and output shapes.)
 */
export const listingFormSchema = z.object({
  listing_type: z.enum(LISTING_TYPE_VALUES),
  property_type: z.enum(PROPERTY_TYPE_VALUES),
  property_name: z.string().trim().min(2, 'Property name is required').max(200),
  title: z.string().optional(),
  description: z.string().optional(),
  bedrooms: z.string().optional(),
  bathrooms: z.string().optional(),
  has_balcony: z.boolean(),
  tower: z.string().optional(),
  building: z.string().optional(),
  floor: z.string().optional(),
  unit_number: z.string().optional(),
  floor_area: z.string().optional(),
  lot_area: z.string().optional(),
  furnishing: z.string().optional(),
  has_parking: z.boolean(),
  parking_slots: z.string().optional(),
  monthly_rent: z.string().optional(),
  selling_price: z.string().optional(),
  association_dues: z.string().optional(),
  security_deposit: z.string().optional(),
  advance: z.string().optional(),
  payment_terms: z.string().optional(),
  is_negotiable: z.boolean(),
  country: z.string().trim().min(1).max(100),
  province: z.string().optional(),
  city: z.string().optional(),
  barangay: z.string().optional(),
  full_address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  amenity_ids: z.array(z.string()),
});

export type ListingInput = z.infer<typeof listingFormSchema>;

const emptyToNull = (val: unknown) => (val === '' || val === undefined ? null : val);
const optionalNonNegativeNumber = z.preprocess(
  emptyToNull,
  z.union([z.coerce.number().min(0, 'Must not be negative'), z.null()])
);
const optionalTrimmedString = (max: number) =>
  z.preprocess(emptyToNull, z.union([z.string().trim().max(max), z.null()]));

/** The authoritative schema: every server action re-validates against this. */
export const listingServerSchema = z.object({
  listing_type: z.enum(LISTING_TYPE_VALUES),
  property_type: z.enum(PROPERTY_TYPE_VALUES),
  property_name: z.string().trim().min(2, 'Property name is required').max(200),
  title: optionalTrimmedString(200),
  description: optionalTrimmedString(5000),

  bedrooms: optionalNonNegativeNumber,
  bathrooms: optionalNonNegativeNumber,
  has_balcony: z.boolean(),
  tower: optionalTrimmedString(200),
  building: optionalTrimmedString(200),
  floor: optionalTrimmedString(50),
  unit_number: optionalTrimmedString(50),
  floor_area: optionalNonNegativeNumber,
  lot_area: optionalNonNegativeNumber,
  furnishing: z.preprocess(emptyToNull, z.union([z.enum(FURNISHING_VALUES), z.null()])),
  has_parking: z.boolean(),
  parking_slots: optionalNonNegativeNumber,

  monthly_rent: optionalNonNegativeNumber,
  selling_price: optionalNonNegativeNumber,
  association_dues: optionalNonNegativeNumber,
  security_deposit: optionalNonNegativeNumber,
  advance: optionalNonNegativeNumber,
  payment_terms: optionalTrimmedString(200),
  is_negotiable: z.boolean(),

  country: z.string().trim().min(1).max(100),
  province: optionalTrimmedString(100),
  city: optionalTrimmedString(100),
  barangay: optionalTrimmedString(100),
  full_address: optionalTrimmedString(500),
  latitude: z.preprocess(emptyToNull, z.union([z.coerce.number().min(-90).max(90), z.null()])),
  longitude: z.preprocess(emptyToNull, z.union([z.coerce.number().min(-180).max(180), z.null()])),

  amenity_ids: z.array(z.string().uuid()),
});

export type ListingServerInput = z.infer<typeof listingServerSchema>;
