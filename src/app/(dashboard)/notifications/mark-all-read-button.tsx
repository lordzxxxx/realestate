'use client';

import { useTransition } from 'react';
import { markAllNotificationsReadAction } from './actions';
import { Button } from '@/components/ui/button';

export function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          markAllNotificationsReadAction();
        })
      }
    >
      Mark all as read
    </Button>
  );
}
