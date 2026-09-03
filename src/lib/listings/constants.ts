import type { FurnishingType, ListingStatus, ListingType, PropertyType } from '@/types/database';

export const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: 'RENT', label: 'For Rent' },
  { value: 'SALE', label: 'For Sale' },
];

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'CONDOMINIUM', label: 'Condominium' },
  { value: 'HOUSE', label: 'House' },
  { value: 'HOUSE_AND_LOT', label: 'House and Lot' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'OFFICE', label: 'Office' },
  { value: 'LOT', label: 'Lot' },
  { value: 'ROOM', label: 'Room' },
  { value: 'BEDSPACE', label: 'Bedspace' },
  { value: 'TOWNHOUSE', label: 'Townhouse' },
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'OTHER', label: 'Other' },
];

export const FURNISHING_TYPES: { value: FurnishingType; label: string }[] = [
  { value: 'UNFURNISHED', label: 'Unfurnished' },
  { value: 'SEMI_FURNISHED', label: 'Semi Furnished' },
  { value: 'FULLY_FURNISHED', label: 'Fully Furnished' },
];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending Review',
  CHANGES_REQUESTED: 'Changes Requested',
  APPROVED: 'Approved',
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  RENTED: 'Rented',
  SOLD: 'Sold',
  TEMPORARILY_UNAVAILABLE: 'Temporarily Unavailable',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
};

export const LISTING_STATUS_STYLES: Record<ListingStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700',
  CHANGES_REQUESTED: 'bg-orange-50 text-orange-700',
  APPROVED: 'bg-sky-50 text-sky-700',
  AVAILABLE: 'bg-emerald-50 text-emerald-700',
  RESERVED: 'bg-amber-50 text-amber-700',
  RENTED: 'bg-slate-100 text-slate-600',
  SOLD: 'bg-slate-100 text-slate-600',
  TEMPORARILY_UNAVAILABLE: 'bg-orange-50 text-orange-700',
  REJECTED: 'bg-red-50 text-red-700',
  ARCHIVED: 'bg-slate-100 text-slate-400',
};

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}
