'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';
import { markNotificationReadAction } from './actions';
import type { Database } from '@/types/database';

type Notification = Database['public']['Tables']['notifications']['Row'];

export function NotificationItem({ notification }: { notification: Notification }) {
  const [isPending, startTransition] = useTransition();
  const isUnread = !notification.read_at;

  const markRead = () => {
    if (!isUnread) return;
    startTransition(() => {
      markNotificationReadAction(notification.id);
    });
  };

  const className = cn(
    'flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors disabled:opacity-70',
    isUnread ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
  );

  const inner = (
    <>
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', isUnread ? 'bg-sky-500' : 'bg-transparent')} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', isUnread ? 'font-medium text-slate-900' : 'text-slate-600')}>{notification.title}</p>
        {notification.body && <p className="text-xs text-slate-500">{notification.body}</p>}
        <p className="mt-1 text-xs text-slate-400">{new Date(notification.created_at).toLocaleString()}</p>
      </div>
    </>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} onClick={markRead} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={markRead} disabled={isPending || !isUnread} className={className}>
      {inner}
    </button>
  );
}
