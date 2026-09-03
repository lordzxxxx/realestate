'use client';

import { useState, useTransition } from 'react';
import { submitListingAction, setListingStatusAction, approveAndPublishAction } from '../actions';
import { Button } from '@/components/ui/button';
import type { Listing } from '@/lib/listings/get-listing';

export function ListingStatusPanel({ listing }: { listing: Listing }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const run = (fn: () => Promise<{ error?: string } | void>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else setNote('');
    });
  };

  const status = listing.status;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => submitListingAction(listing.id))}>
            Submit
          </Button>
        )}

        {status === 'PENDING_REVIEW' && (
          <>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => run(() => approveAndPublishAction(listing.id, note || undefined))}
            >
              Approve &amp; Publish
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => run(() => setListingStatusAction(listing.id, 'CHANGES_REQUESTED', note || undefined))}
            >
              Request Changes
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => run(() => setListingStatusAction(listing.id, 'REJECTED', note || undefined))}
            >
              Reject
            </Button>
          </>
        )}

        {status === 'CHANGES_REQUESTED' && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => submitListingAction(listing.id))}>
            Resubmit
          </Button>
        )}

        {status === 'APPROVED' && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => run(() => setListingStatusAction(listing.id, 'AVAILABLE'))}
          >
            Publish
          </Button>
        )}

        {status === 'AVAILABLE' && (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => run(() => setListingStatusAction(listing.id, 'RESERVED'))}
            >
              Mark Reserved
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() =>
                run(() =>
                  setListingStatusAction(listing.id, listing.listing_type === 'RENT' ? 'RENTED' : 'SOLD')
                )
              }
            >
              {listing.listing_type === 'RENT' ? 'Mark Rented' : 'Mark Sold'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => run(() => setListingStatusAction(listing.id, 'TEMPORARILY_UNAVAILABLE'))}
            >
              Temporarily Unavailable
            </Button>
          </>
        )}

        {status === 'RESERVED' && (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => run(() => setListingStatusAction(listing.id, 'AVAILABLE'))}
            >
              Back to Available
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() =>
                run(() =>
                  setListingStatusAction(listing.id, listing.listing_type === 'RENT' ? 'RENTED' : 'SOLD')
                )
              }
            >
              {listing.listing_type === 'RENT' ? 'Mark Rented' : 'Mark Sold'}
            </Button>
          </>
        )}

        {status === 'TEMPORARILY_UNAVAILABLE' && (
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => run(() => setListingStatusAction(listing.id, 'AVAILABLE'))}
          >
            Back to Available
          </Button>
        )}

        {status !== 'ARCHIVED' && (
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => run(() => setListingStatusAction(listing.id, 'ARCHIVED'))}
          >
            Archive
          </Button>
        )}
      </div>

      {(status === 'PENDING_REVIEW' || status === 'DRAFT') && (
        <input
          type="text"
          placeholder="Optional note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full max-w-sm rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
