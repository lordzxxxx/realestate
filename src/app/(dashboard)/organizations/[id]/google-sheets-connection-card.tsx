'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { googleSheetsConnectionSchema, type GoogleSheetsConnectionInput } from '@/lib/google/schemas';
import {
  saveGoogleSheetsSettingsAction,
  testGoogleSheetsConnectionAction,
  reconcileGoogleSheetsAction,
} from './google-sheets-actions';
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

export function GoogleSheetsConnectionCard({
  organizationId,
  serviceAccountEmail,
  defaultValues,
  status,
  lastCheckedAt,
  lastSyncedAt,
  lastError,
  orgSyncEnabled,
}: {
  organizationId: string;
  serviceAccountEmail: string | null;
  defaultValues: GoogleSheetsConnectionInput;
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
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);
  const [isTesting, startTest] = useTransition();
  const [isReconciling, startReconcile] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<GoogleSheetsConnectionInput>({
    resolver: zodResolver(googleSheetsConnectionSchema),
    defaultValues,
  });

  const onSave = async (data: GoogleSheetsConnectionInput) => {
    setSaveError(null);
    setSaved(false);
    setTestOk(false);
    setTestError(null);
    const result = await saveGoogleSheetsSettingsAction(organizationId, data);
    if (result?.error) setSaveError(result.error);
    else setSaved(true);
  };

  const onTest = () => {
    setTestError(null);
    setTestOk(false);
    setSaved(false);
    startTest(async () => {
      const result = await testGoogleSheetsConnectionAction(organizationId);
      if (result?.error) setTestError(result.error);
      else setTestOk(true);
    });
  };

  const onReconcile = () => {
    setReconcileMessage(null);
    startReconcile(async () => {
      const result = await reconcileGoogleSheetsAction(organizationId);
      if (result?.error) setReconcileMessage(`Error: ${result.error}`);
      else setReconcileMessage(`Queued ${result.queued ?? 0} listing(s) for sync.`);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
          {STATUS_LABELS[status]}
        </span>
        {lastSyncedAt && (
          <span className="text-xs text-slate-500">Last synced {new Date(lastSyncedAt).toLocaleString()}</span>
        )}
      </div>

      {status === 'ERROR' && lastError && (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{lastError}</p>
      )}

      {!orgSyncEnabled && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          &ldquo;Auto-sync to Google Sheets&rdquo; is turned off in Automation settings above — listing changes
          won&apos;t sync until it&apos;s re-enabled, even while this connection is verified.
        </p>
      )}

      {serviceAccountEmail ? (
        <p className="text-xs text-slate-500">
          Share your spreadsheet (Editor access) with{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">{serviceAccountEmail}</code>, then paste its ID or URL
          below.
        </p>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          No Google service account is configured on this deployment yet (GOOGLE_SERVICE_ACCOUNT_KEY). Settings can be
          saved, but &ldquo;Test connection&rdquo; and syncing will fail until it is.
        </p>
      )}

      <form onSubmit={handleSubmit(onSave)} noValidate className="space-y-3">
        <div>
          <Label htmlFor="spreadsheet_id">Spreadsheet ID or URL</Label>
          <Input id="spreadsheet_id" placeholder="https://docs.google.com/spreadsheets/d/…" {...register('spreadsheet_id')} />
          <FieldError message={errors.spreadsheet_id?.message} />
        </div>
        <div>
          <Label htmlFor="property_sheet_name">Sheet / tab name</Label>
          <Input id="property_sheet_name" {...register('property_sheet_name')} />
          <FieldError message={errors.property_sheet_name?.message} />
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isReconciling || status !== 'CONNECTED'}
            onClick={onReconcile}
          >
            {isReconciling ? 'Syncing…' : 'Sync all now'}
          </Button>
        </div>

        {testError && <p className="text-sm text-red-600">{testError}</p>}
        {testOk && <p className="text-sm text-emerald-600">Connection verified.</p>}
        {reconcileMessage && <p className="text-sm text-slate-600">{reconcileMessage}</p>}
        {lastCheckedAt && (
          <p className="text-xs text-slate-400">Last checked {new Date(lastCheckedAt).toLocaleString()}</p>
        )}
      </form>
    </div>
  );
}
