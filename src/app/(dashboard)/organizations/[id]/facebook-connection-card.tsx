'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { facebookPageConnectionSchema, type FacebookPageConnectionInput } from '@/lib/facebook/schemas';
import { saveFacebookSettingsAction, testFacebookConnectionAction } from './facebook-actions';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTED' | 'ERROR';

const STATUS_STYLES: Record<ConnectionStatus, string> = {
  DISCONNECTED: 'bg-slate-100 text-slate-700',
  CONNECTED: 'bg-emerald-100 text-emerald-700',
  ERROR: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  DISCONNECTED: 'Not connected',
  CONNECTED: 'Connected',
  ERROR: 'Error',
};

export function FacebookConnectionCard({
  organizationId,
  pageId,
  pageName,
  status,
  lastCheckedAt,
  lastSyncedAt,
  lastError,
  orgSyncEnabled,
}: {
  organizationId: string;
  pageId: string | null;
  pageName: string | null;
  status: ConnectionStatus;
  lastCheckedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  orgSyncEnabled: boolean;
}) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(false);
  const [isTesting, startTest] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FacebookPageConnectionInput>({
    resolver: zodResolver(facebookPageConnectionSchema),
    // access_token is never pre-filled — the server never sends it back to
    // the client (see migration 0025's column-level SELECT revoke).
    defaultValues: { page_id: pageId ?? '', access_token: '' },
  });

  const onSave = async (data: FacebookPageConnectionInput) => {
    setSaveError(null);
    setSaved(false);
    setTestOk(false);
    setTestError(null);
    const result = await saveFacebookSettingsAction(organizationId, data);
    if (result?.error) setSaveError(result.error);
    else setSaved(true);
  };

  const onTest = () => {
    setTestError(null);
    setTestOk(false);
    setSaved(false);
    startTest(async () => {
      const result = await testFacebookConnectionAction(organizationId);
      if (result?.error) setTestError(result.error);
      else setTestOk(true);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
          {STATUS_LABELS[status]}
        </span>
        {pageName && <span className="text-xs text-slate-500">{pageName}</span>}
        {lastSyncedAt && (
          <span className="text-xs text-slate-500">Last posted {new Date(lastSyncedAt).toLocaleString()}</span>
        )}
      </div>

      {status === 'ERROR' && lastError && (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {lastError}{' '}
          <Link href="/admin/automation" className="underline">
            View in Automation Center →
          </Link>
        </p>
      )}

      {!orgSyncEnabled && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          &ldquo;Auto-publish to Facebook&rdquo; is turned off in Automation settings above — listing changes
          won&apos;t post until it&apos;s re-enabled, even while this connection is verified.
        </p>
      )}

      <p className="text-xs text-slate-500">
        Generate a long-lived Page Access Token for your Facebook Page (Meta Business Suite → Page settings → Page
        access tokens, or the Graph API Explorer), then paste your Page ID and that token below. The token is never
        shown again once saved.
      </p>

      <form onSubmit={handleSubmit(onSave)} noValidate className="space-y-3">
        <div>
          <Label htmlFor="page_id">Page ID</Label>
          <Input id="page_id" {...register('page_id')} />
          <FieldError message={errors.page_id?.message} />
        </div>
        <div>
          <Label htmlFor="access_token">Page access token</Label>
          <Input id="access_token" type="password" placeholder={pageId ? '••••••••  (saved — leave blank to keep)' : ''} {...register('access_token')} />
          <FieldError message={errors.access_token?.message} />
        </div>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        {saved && <p className="text-sm text-emerald-600">Saved — run &ldquo;Test connection&rdquo; to verify.</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? 'Saving…' : 'Save settings'}
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={isTesting} onClick={onTest}>
            {isTesting ? 'Testing…' : 'Test connection'}
          </Button>
        </div>

        {testError && <p className="text-sm text-red-600">{testError}</p>}
        {testOk && <p className="text-sm text-emerald-600">Connection verified.</p>}
        {lastCheckedAt && (
          <p className="text-xs text-slate-400">Last checked {new Date(lastCheckedAt).toLocaleString()}</p>
        )}
      </form>

      <p className="text-xs text-slate-400">
        Failed posts and retries now live in the{' '}
        <Link href="/admin/automation" className="underline hover:text-slate-600">
          Automation Center
        </Link>
        .
      </p>
    </div>
  );
}
