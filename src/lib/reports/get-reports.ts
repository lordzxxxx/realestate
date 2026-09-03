import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ListingStatus, ListingType, InquiryStatus, ViewingStatus } from '@/types/database';

// Phase 9 (Reports, "operational reports" scope): every query below is a
// plain authenticated select with no manual own/organization/all branching
// — RLS (listings_select, inquiries_select, viewing_requests_select) already
// scopes exactly which rows a given session can see, keyed off the same
// listing.read_*/inquiry.view_*/viewing.view permissions those roles hold
// alongside their reports.* grants. Reimplementing that scoping here would
// just be a second, driftable copy of a decision the database already
// makes correctly.

const STALE_VERIFICATION_DAYS = 7;

export interface ListingsReport {
  totalCount: number;
  countsByStatus: Record<ListingStatus, number>;
  countsByType: Record<ListingType, number>;
  activeMonthlyRentValue: number;
  activeSellingPriceValue: number;
  verification: {
    totalAvailable: number;
    verified: number;
    stale: number;
    compliancePct: number | null;
  };
}

export async function getListingsReport(): Promise<ListingsReport> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('listings')
    .select('status, listing_type, monthly_rent, selling_price, last_verified_at');

  const rows = data ?? [];
  const staleCutoff = Date.now() - STALE_VERIFICATION_DAYS * 24 * 60 * 60 * 1000;

  const countsByStatus: Record<ListingStatus, number> = {
    DRAFT: 0,
    PENDING_REVIEW: 0,
    CHANGES_REQUESTED: 0,
    APPROVED: 0,
    AVAILABLE: 0,
    RESERVED: 0,
    RENTED: 0,
    SOLD: 0,
    TEMPORARILY_UNAVAILABLE: 0,
    REJECTED: 0,
    ARCHIVED: 0,
  };
  const countsByType: Record<ListingType, number> = { RENT: 0, SALE: 0 };
  let activeMonthlyRentValue = 0;
  let activeSellingPriceValue = 0;
  let verified = 0;
  let stale = 0;

  for (const row of rows) {
    countsByStatus[row.status] += 1;
    countsByType[row.listing_type] += 1;

    if (row.status === 'AVAILABLE') {
      if (row.listing_type === 'RENT' && row.monthly_rent) activeMonthlyRentValue += row.monthly_rent;
      if (row.listing_type === 'SALE' && row.selling_price) activeSellingPriceValue += row.selling_price;

      const isStale = !row.last_verified_at || new Date(row.last_verified_at).getTime() < staleCutoff;
      if (isStale) stale += 1;
      else verified += 1;
    }
  }

  const totalAvailable = verified + stale;

  return {
    totalCount: rows.length,
    countsByStatus,
    countsByType,
    activeMonthlyRentValue,
    activeSellingPriceValue,
    verification: {
      totalAvailable,
      verified,
      stale,
      compliancePct: totalAvailable > 0 ? Math.round((verified / totalAvailable) * 100) : null,
    },
  };
}

export async function getInquiriesCountsByStatus(): Promise<Record<InquiryStatus, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from('inquiries').select('status');

  const counts: Record<InquiryStatus, number> = {
    NEW: 0,
    ASSIGNED: 0,
    CONTACTED: 0,
    VIEWING_SCHEDULED: 0,
    FOLLOW_UP: 0,
    CONVERTED: 0,
    LOST: 0,
    CLOSED: 0,
  };
  for (const row of data ?? []) counts[row.status] += 1;
  return counts;
}

export async function getViewingsCountsByStatus(): Promise<Record<ViewingStatus, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from('viewing_requests').select('status');

  const counts: Record<ViewingStatus, number> = {
    REQUESTED: 0,
    CONFIRMED: 0,
    RESCHEDULED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  for (const row of data ?? []) counts[row.status] += 1;
  return counts;
}
