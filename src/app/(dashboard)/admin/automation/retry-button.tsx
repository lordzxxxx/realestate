'use client';

import { useState, useTransition } from 'react';
import { retrySyncJobAction } from './actions';
import { Button } from '@/components/ui/button';

export function RetryButton({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const onRetry = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await retrySyncJobAction(jobId);
      setMessage(result?.error ? `Error: ${result.error}` : 'Re-queued.');
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" size="sm" disabled={isPending} onClick={onRetry}>
        {isPending ? 'Retrying…' : 'Retry'}
      </Button>
      {message && <p className="text-xs text-slate-500">{message}</p>}
    </div>
  );
}
