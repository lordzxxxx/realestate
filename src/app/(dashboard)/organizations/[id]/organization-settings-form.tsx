'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { OrganizationSettingsInput } from '@/lib/organizations/schemas';
import { updateOrganizationSettingsAction } from '../actions';
import { Button } from '@/components/ui/button';

const TOGGLES: { key: keyof OrganizationSettingsInput; label: string; hint: string }[] = [
  {
    key: 'auto_approve_registrations',
    label: 'Auto-approve registrations',
    hint: 'New external registrants for this organization skip management review.',
  },
  {
    key: 'listing_approval_required',
    label: 'Require listing approval',
    hint: 'Listings must be approved before they publish, unless the agent has listing.publish_directly.',
  },
  {
    key: 'auto_publish_website',
    label: 'Auto-publish to website',
    hint: 'Approved listings go live on the public site automatically.',
  },
  {
    key: 'auto_publish_facebook',
    label: 'Auto-publish to Facebook',
    hint: 'Published listings automatically post to the connected Facebook Page (Phase 7).',
  },
  {
    key: 'auto_sync_google_sheets',
    label: 'Auto-sync to Google Sheets',
    hint: 'Listing changes automatically sync to the connected spreadsheet (Phase 6).',
  },
];

export function OrganizationSettingsForm({
  organizationId,
  defaultValues,
}: {
  organizationId: string;
  defaultValues: OrganizationSettingsInput;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<OrganizationSettingsInput>({
    defaultValues,
  });

  const onSubmit = async (data: OrganizationSettingsInput) => {
    setServerError(null);
    setSaved(false);
    const result = await updateOrganizationSettingsAction(organizationId, data);
    if (result?.error) setServerError(result.error);
    else setSaved(true);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {TOGGLES.map((t) => (
        <label key={t.key} className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" {...register(t.key)} />
          <span>
            <span className="block text-sm font-medium text-slate-900">{t.label}</span>
            <span className="block text-xs text-slate-500">{t.hint}</span>
          </span>
        </label>
      ))}

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {saved && <p className="text-sm text-emerald-600">Saved.</p>}

      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save settings'}
      </Button>
    </form>
  );
}
