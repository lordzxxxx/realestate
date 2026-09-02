import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/auth/permissions';
import { ApprovalActions } from './approval-actions';
import { UserStatusActions } from './user-status-actions';

export default async function ApprovalsPage() {
  if (!(await hasPermission('user.approve'))) redirect('/dashboard');

  const supabase = await createClient();

  const [{ data: pending }, { data: active }, { data: suspended }] = await Promise.all([
    supabase.from('profiles').select('*').eq('status', 'PENDING').order('created_at', { ascending: true }),
    supabase.from('profiles').select('*').eq('status', 'ACTIVE').order('full_name'),
    supabase.from('profiles').select('*').eq('status', 'SUSPENDED').order('full_name'),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">User Approvals</h1>
        <p className="text-sm text-slate-500">Review new registrations and manage account status.</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          Pending review {pending && pending.length > 0 && `(${pending.length})`}
        </h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {pending?.length ? (
            <ul className="divide-y divide-slate-100">
              {pending.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {p.email} · {p.phone || 'no phone'} · {p.user_category}
                      {p.organization_name ? ` · ${p.organization_name}` : ''}
                    </p>
                  </div>
                  <ApprovalActions profileId={p.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No pending registrations.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Active users</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {active?.length ? (
            <ul className="divide-y divide-slate-100">
              {active.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {p.email} · {p.user_category}
                    </p>
                  </div>
                  <UserStatusActions profileId={p.id} status={p.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No active users.</p>
          )}
        </div>
      </section>

      {suspended && suspended.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Suspended</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {suspended.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {p.email} · {p.user_category}
                    </p>
                  </div>
                  <UserStatusActions profileId={p.id} status={p.status} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
