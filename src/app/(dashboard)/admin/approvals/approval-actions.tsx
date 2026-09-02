'use client';

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { setProfileStatusAction } from './actions';
import { Button } from '@/components/ui/button';

export function ApprovalActions({ profileId }: { profileId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (status: 'ACTIVE' | 'ARCHIVED') => {
    setError(null);
    startTransition(async () => {
      const result = await setProfileStatusAction(profileId, status);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={isPending} onClick={() => act('ACTIVE')}>
        <Check className="h-4 w-4" /> Approve
      </Button>
      <Button size="sm" variant="destructive" disabled={isPending} onClick={() => act('ARCHIVED')}>
        <X className="h-4 w-4" /> Reject
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
