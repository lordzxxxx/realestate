'use client';

import { useState, useTransition } from 'react';
import { setProfileStatusAction } from './actions';
import { Button } from '@/components/ui/button';
import type { ProfileStatus } from '@/types/database';

export function UserStatusActions({ profileId, status }: { profileId: string; status: ProfileStatus }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (next: ProfileStatus) => {
    setError(null);
    startTransition(async () => {
      const result = await setProfileStatusAction(profileId, next);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {status === 'ACTIVE' && (
        <Button size="sm" variant="secondary" disabled={isPending} onClick={() => act('SUSPENDED')}>
          Suspend
        </Button>
      )}
      {status === 'SUSPENDED' && (
        <Button size="sm" variant="secondary" disabled={isPending} onClick={() => act('ACTIVE')}>
          Reactivate
        </Button>
      )}
      {status !== 'ARCHIVED' && (
        <Button size="sm" variant="destructive" disabled={isPending} onClick={() => act('ARCHIVED')}>
          Archive
        </Button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
