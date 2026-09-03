import { createClient } from '@/lib/supabase/server';
import { NotificationItem } from './notification-item';
import { MarkAllReadButton } from './mark-all-read-button';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const hasUnread = (notifications ?? []).some((n) => !n.read_at);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
        {hasUnread && <MarkAllReadButton />}
      </div>

      <div className="space-y-2">
        {notifications?.map((n) => (
          <NotificationItem key={n.id} notification={n} />
        ))}
        {notifications?.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            No notifications yet.
          </p>
        )}
      </div>
    </div>
  );
}
