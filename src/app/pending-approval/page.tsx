import { redirect } from 'next/navigation';
import { Clock3 } from 'lucide-react';
import { getCurrentSession } from '@/lib/auth/session';
import { logoutAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';

export default async function PendingApprovalPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.profile.status === 'ACTIVE') redirect('/dashboard');

  const isSuspended = session.profile.status === 'SUSPENDED';
  const isArchived = session.profile.status === 'ARCHIVED';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Clock3 className="mx-auto mb-4 h-10 w-10 text-slate-400" strokeWidth={1.5} />
        <h1 className="mb-2 text-xl font-semibold text-slate-900">
          {isSuspended ? 'Account suspended' : isArchived ? 'Account archived' : 'Awaiting approval'}
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          {isSuspended &&
            'Your account has been suspended. Contact management if you believe this is a mistake.'}
          {isArchived && 'This account is archived and no longer active.'}
          {!isSuspended && !isArchived && (
            <>
              Thanks for registering, {session.profile.full_name}. Management needs to review and approve
              your account before you can access the dashboard. You&apos;ll be notified once it&apos;s
              approved.
            </>
          )}
        </p>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
