import type { FurnishingType, ListingType, PropertyType } from '@/types/database';

export type SortOption = 'newest' | 'price_low' | 'price_high' | 'recently_verified';

export interface PropertySearchFilters {
  q?: string;
  listingType?: ListingType;
  propertyType?: PropertyType;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  furnishing?: FurnishingType;
  availableOnly?: boolean;
  sort: SortOption;
}

type SearchParamsInput = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const LISTING_TYPES: ListingType[] = ['RENT', 'SALE'];
const PROPERTY_TYPES: PropertyType[] = [
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
];
const FURNISHING_TYPES: FurnishingType[] = ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'];
const SORT_OPTIONS: SortOption[] = ['newest', 'price_low', 'price_high', 'recently_verified'];

export function parseSearchFilters(params: SearchParamsInput, defaults?: Partial<PropertySearchFilters>): PropertySearchFilters {
  const listingTypeRaw = first(params.type)?.toUpperCase();
  const propertyTypeRaw = first(params.propertyType)?.toUpperCase();
  const furnishingRaw = first(params.furnishing)?.toUpperCase();
  const sortRaw = first(params.sort);

  return {
    q: first(params.q)?.trim() || undefined,
    listingType:
      (LISTING_TYPES.includes(listingTypeRaw as ListingType) ? (listingTypeRaw as ListingType) : undefined) ??
      defaults?.listingType,
    propertyType: PROPERTY_TYPES.includes(propertyTypeRaw as PropertyType) ? (propertyTypeRaw as PropertyType) : undefined,
    city: first(params.city)?.trim() || undefined,
    minPrice: toNumber(first(params.minPrice)),
    maxPrice: toNumber(first(params.maxPrice)),
    bedrooms: toNumber(first(params.bedrooms)),
    bathrooms: toNumber(first(params.bathrooms)),
    furnishing: FURNISHING_TYPES.includes(furnishingRaw as FurnishingType) ? (furnishingRaw as FurnishingType) : undefined,
    availableOnly: first(params.availableOnly) === '1',
    sort: SORT_OPTIONS.includes(sortRaw as SortOption) ? (sortRaw as SortOption) : 'newest',
  };
}
