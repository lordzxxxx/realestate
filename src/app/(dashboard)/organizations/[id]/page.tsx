import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getServiceAccountEmail } from '@/lib/google/sheets';
import { OrganizationForm } from '../organization-form';
import { OrganizationSettingsForm } from './organization-settings-form';
import { OrganizationStatusControl } from './organization-status-control';
import { GoogleSheetsConnectionCard } from './google-sheets-connection-card';
import { FacebookConnectionCard, type FailedFacebookJob } from './facebook-connection-card';

export default async function OrganizationDetailPage(props: PageProps<'/organizations/[id]'>) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [
    { data: organization },
    { data: settings },
    { data: sheetsConnection },
    { data: facebookConnection },
    canEdit,
    canViewIntegrations,
    canManageSheets,
    canManageFacebook,
  ] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', id).maybeSingle(),
    supabase.from('organization_settings').select('*').eq('organization_id', id).maybeSingle(),
    supabase.from('google_sheet_connections').select('*').eq('organization_id', id).maybeSingle(),
    // Explicit column list — access_token is column-level REVOKEd for
    // authenticated anyway (migration 0025), but naming the safe columns
    // here keeps that boundary visible in the code, not just in the DB.
    supabase
      .from('facebook_page_connections')
      .select('organization_id, page_id, page_name, status, last_checked_at, last_synced_at, last_error')
      .eq('organization_id', id)
      .maybeSingle(),
    hasPermission('organization.edit', id),
    hasPermission('integrations.view', id),
    Promise.all([hasPermission('integrations.manage', id), hasPermission('integrations.google', id)]).then(
      ([manage, google]) => manage || google
    ),
    Promise.all([hasPermission('integrations.manage', id), hasPermission('integrations.facebook', id)]).then(
      ([manage, facebook]) => manage || facebook
    ),
  ]);

  if (!organization) notFound();

  let failedFacebookJobs: FailedFacebookJob[] = [];
  if (canManageFacebook) {
    const { data: jobs } = await supabase
      .from('sync_jobs')
      .select('id, payload, last_error, created_at')
      .eq('organization_id', id)
      .eq('platform', 'FACEBOOK')
      .eq('status', 'FAILED_REQUIRES_ATTENTION')
      .order('created_at', { ascending: false })
      .limit(20);

    failedFacebookJobs = (jobs ?? []).map((job) => {
      const payload = job.payload as { property_name?: string; listing_number?: string };
      return {
        id: job.id,
        propertyName: payload.property_name ?? 'Unknown listing',
        listingNumber: payload.listing_number ?? '—',
        lastError: job.last_error,
        createdAt: job.created_at,
      };
    });
  }

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

      {canViewIntegrations && sheetsConnection && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Google Sheets integration</h2>
          {canManageSheets ? (
            <GoogleSheetsConnectionCard
              organizationId={organization.id}
              serviceAccountEmail={getServiceAccountEmail()}
              defaultValues={{
                spreadsheet_id: sheetsConnection.spreadsheet_id ?? '',
                property_sheet_name: sheetsConnection.property_sheet_name,
              }}
              status={sheetsConnection.status}
              lastCheckedAt={sheetsConnection.last_checked_at}
              lastSyncedAt={sheetsConnection.last_synced_at}
              lastError={sheetsConnection.last_error}
              orgSyncEnabled={settings?.auto_sync_google_sheets ?? true}
            />
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd className="text-slate-900">{sheetsConnection.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Last synced</dt>
                <dd className="text-slate-900">
                  {sheetsConnection.last_synced_at ? new Date(sheetsConnection.last_synced_at).toLocaleString() : '—'}
                </dd>
              </div>
            </dl>
          )}
        </section>
      )}

      {canViewIntegrations && facebookConnection && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Facebook Page integration</h2>
          {canManageFacebook ? (
            <FacebookConnectionCard
              organizationId={organization.id}
              pageId={facebookConnection.page_id}
              pageName={facebookConnection.page_name}
              status={facebookConnection.status}
              lastCheckedAt={facebookConnection.last_checked_at}
              lastSyncedAt={facebookConnection.last_synced_at}
              lastError={facebookConnection.last_error}
              orgSyncEnabled={settings?.auto_publish_facebook ?? true}
              failedJobs={failedFacebookJobs}
            />
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd className="text-slate-900">{facebookConnection.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Last posted</dt>
                <dd className="text-slate-900">
                  {facebookConnection.last_synced_at ? new Date(facebookConnection.last_synced_at).toLocaleString() : '—'}
                </dd>
              </div>
            </dl>
          )}
        </section>
      )}
    </div>
  );
}
