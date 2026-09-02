import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/auth/permissions';
import { OrganizationForm } from '../organization-form';

export default async function NewOrganizationPage() {
  if (!(await hasPermission('organization.create'))) redirect('/organizations');

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">New Organization</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <OrganizationForm />
      </div>
    </div>
  );
}
