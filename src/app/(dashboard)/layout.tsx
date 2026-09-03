import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth/session';
import { getMyPermissions } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/nav/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.profile.status !== 'ACTIVE') redirect('/pending-approval');

  const supabase = await createClient();
  const [grants, { count: unreadNotificationCount }] = await Promise.all([
    getMyPermissions(),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);

  return (
    <div className="flex h-screen">
      <Sidebar grants={grants} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar profile={session.profile} unreadNotificationCount={unreadNotificationCount ?? 0} />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
