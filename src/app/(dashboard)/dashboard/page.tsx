import { getCurrentSession } from '@/lib/auth/session';
import { getMyPermissions } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const session = await getCurrentSession();
  const grants = await getMyPermissions();

  let organizationName: string | null = null;
  if (session?.profile.organization_id) {
    const supabase = await createClient();
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', session.profile.organization_id)
      .maybeSingle();
    organizationName = org?.name ?? null;
  }

  const permissionsByCategory = grants.reduce<Record<string, string[]>>((acc, g) => {
    const category = g.permission_key.split('.')[0];
    acc[category] ??= [];
    if (!acc[category].includes(g.permission_key)) acc[category].push(g.permission_key);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Welcome, {session?.profile.full_name}</h1>
        <p className="text-sm text-slate-500">
          {organizationName ?? 'No organization assigned yet'} · Account status: {session?.profile.status}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Your permissions</h2>
        {Object.keys(permissionsByCategory).length === 0 ? (
          <p className="text-sm text-slate-500">
            No roles assigned yet. Ask a Company Admin or Super Admin to grant you a role.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Object.entries(permissionsByCategory).map(([category, keys]) => (
              <div key={category}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{category}</p>
                <ul className="space-y-0.5">
                  {keys.map((k) => (
                    <li key={k} className="text-xs text-slate-600">
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
        Property listings, inquiries, and automation status will appear here starting Phase 2.
      </div>
    </div>
  );
}
