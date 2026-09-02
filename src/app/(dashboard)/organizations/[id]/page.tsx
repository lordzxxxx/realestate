import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/auth/permissions';
import { OrganizationForm } from '../organization-form';
import { OrganizationSettingsForm } from './organization-settings-form';
import { OrganizationStatusControl } from './organization-status-control';

export default async function OrganizationDetailPage(props: PageProps<'/organizations/[id]'>) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: organization }, { data: settings }, canEdit] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', id).maybeSingle(),
    supabase.from('organization_settings').select('*').eq('organization_id', id).maybeSingle(),
    hasPermission('organization.edit', id),
  ]);

  if (!organization) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{organization.name}</h1>
          <p className="text-sm text-slate-400">/{organization.slug}</p>
        </div>
        {canEdit && <OrganizationStatusControl organizationId={organization.id} status={organization.status} />}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Details</h2>
        {canEdit ? (
          <OrganizationForm
            organizationId={organization.id}
            defaultValues={{
              name: organization.name,
              contact_email: organization.contact_email ?? '',
              contact_phone: organization.contact_phone ?? '',
              address: organization.address ?? '',
            }}
          />
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Contact email</dt>
              <dd className="text-slate-900">{organization.contact_email || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Contact phone</dt>
              <dd className="text-slate-900">{organization.contact_phone || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Address</dt>
              <dd className="text-slate-900">{organization.address || '—'}</dd>
            </div>
          </dl>
        )}
      </section>

      {canEdit && settings && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Automation settings</h2>
          <OrganizationSettingsForm
            organizationId={organization.id}
            defaultValues={{
              auto_approve_registrations: settings.auto_approve_registrations,
              listing_approval_required: settings.listing_approval_required,
              auto_publish_website: settings.auto_publish_website,
              auto_publish_facebook: settings.auto_publish_facebook,
              auto_sync_google_sheets: settings.auto_sync_google_sheets,
            }}
          />
        </section>
      )}
    </div>
  );
}
