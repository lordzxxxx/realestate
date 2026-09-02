'use client';

import { useState, useTransition } from 'react';
import type { OrganizationStatus } from '@/types/database';
import { setOrganizationStatusAction } from '../actions';
import { Button } from '@/components/ui/button';

export function OrganizationStatusControl({
  organizationId,
  status,
}: {
  organizationId: string;
  status: OrganizationStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const change = (next: OrganizationStatus) => {
    setError(null);
    startTransition(async () => {
      const result = await setOrganizationStatusAction(organizationId, next);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {status !== 'ACTIVE' && (
        <Button size="sm" variant="secondary" disabled={isPending} onClick={() => change('ACTIVE')}>
          Activate
        </Button>
      )}
      {status !== 'SUSPENDED' && (
        <Button size="sm" variant="secondary" disabled={isPending} onClick={() => change('SUSPENDED')}>
          Suspend
        </Button>
      )}
      {status !== 'ARCHIVED' && (
        <Button size="sm" variant="destructive" disabled={isPending} onClick={() => change('ARCHIVED')}>
          Archive
        </Button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
