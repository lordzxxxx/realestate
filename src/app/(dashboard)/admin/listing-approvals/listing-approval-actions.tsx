'use client';

import { useState, useTransition } from 'react';
import { Check, MessageSquareWarning, X } from 'lucide-react';
import { approveAndPublishAction, setListingStatusAction } from '../../listings/actions';
import { Button } from '@/components/ui/button';

export function ListingApprovalActions({ listingId }: { listingId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={isPending} onClick={() => run(() => approveAndPublishAction(listingId))}>
        <Check className="h-4 w-4" /> Approve &amp; Publish
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={isPending}
        onClick={() => run(() => setListingStatusAction(listingId, 'CHANGES_REQUESTED'))}
      >
        <MessageSquareWarning className="h-4 w-4" /> Request Changes
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={isPending}
        onClick={() => run(() => setListingStatusAction(listingId, 'REJECTED'))}
      >
        <X className="h-4 w-4" /> Reject
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
