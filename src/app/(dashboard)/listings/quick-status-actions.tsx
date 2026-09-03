'use client';

import { useState, useTransition } from 'react';
import { submitListingAction, setListingStatusAction, verifyListingAction } from './actions';
import { Button } from '@/components/ui/button';
import type { ListingStatus, ListingType } from '@/types/database';

const STALE_VERIFICATION_DAYS = 7;

function isStale(lastVerifiedAt: string | null): boolean {
  if (!lastVerifiedAt) return true;
  return Date.now() - new Date(lastVerifiedAt).getTime() > STALE_VERIFICATION_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Compact 1-2 button quick actions for the listings list (section 40: "an
 * availability update should take only a few taps"). The full transition
 * panel with every option lives on the listing detail page — this is
 * deliberately narrower, showing only the single most common next step(s).
 */
export function QuickStatusActions({
  listingId,
  status,
  listingType,
  lastVerifiedAt,
}: {
  listingId: string;
  status: ListingStatus;
  listingType: ListingType;
  lastVerifiedAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
    });
  };

  const buttons: { label: string; onClick: () => void; variant?: 'secondary' | 'primary' }[] = [];

  if (status === 'DRAFT' || status === 'CHANGES_REQUESTED') {
    buttons.push({ label: 'Submit', onClick: () => run(() => submitListingAction(listingId)) });
  }
  if (status === 'AVAILABLE') {
    buttons.push(
      { label: 'Reserve', onClick: () => run(() => setListingStatusAction(listingId, 'RESERVED')), variant: 'secondary' },
      {
        label: listingType === 'RENT' ? 'Rented' : 'Sold',
        onClick: () => run(() => setListingStatusAction(listingId, listingType === 'RENT' ? 'RENTED' : 'SOLD')),
        variant: 'secondary',
      }
    );
    if (isStale(lastVerifiedAt)) {
      buttons.push({
        label: 'Confirm Available',
        onClick: () => run(() => verifyListingAction(listingId)),
        variant: 'secondary',
      });
    }
  }
  if (status === 'RESERVED') {
    buttons.push(
      { label: 'Available', onClick: () => run(() => setListingStatusAction(listingId, 'AVAILABLE')), variant: 'secondary' },
      {
        label: listingType === 'RENT' ? 'Rented' : 'Sold',
        onClick: () => run(() => setListingStatusAction(listingId, listingType === 'RENT' ? 'RENTED' : 'SOLD')),
        variant: 'secondary',
      }
    );
  }
  if (status === 'TEMPORARILY_UNAVAILABLE') {
    buttons.push({ label: 'Available', onClick: () => run(() => setListingStatusAction(listingId, 'AVAILABLE')), variant: 'secondary' });
  }

  if (buttons.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {buttons.map((b) => (
        <Button key={b.label} size="sm" variant={b.variant ?? 'primary'} disabled={isPending} onClick={b.onClick}>
          {b.label}
        </Button>
      ))}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
