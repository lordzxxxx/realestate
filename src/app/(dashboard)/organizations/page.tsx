import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const [{ data: organizations, error }, canCreate] = await Promise.all([
    supabase.from('organizations').select('*').order('created_at', { ascending: false }),
    hasPermission('organization.create'),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Organizations</h1>
        {canCreate && (
          <Link href="/organizations/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> New Organization
            </Button>
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Contact</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {organizations?.map((org) => (
              <tr key={org.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/organizations/${org.id}`} className="font-medium text-slate-900 hover:underline">
                    {org.name}
                  </Link>
                  <p className="text-xs text-slate-400">/{org.slug}</p>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{org.contact_email || org.contact_phone || '—'}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={org.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-500">{new Date(org.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {organizations?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No organizations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700',
    SUSPENDED: 'bg-amber-50 text-amber-700',
    ARCHIVED: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? ''}`}>{status}</span>
  );
}
