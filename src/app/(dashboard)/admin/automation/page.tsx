import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyPermissions } from '@/lib/auth/permissions';
import { canAny } from '@/lib/auth/permission-utils';
import { RetryButton } from './retry-button';
import type { SyncJobStatus } from '@/types/database';

const STATUS_LABELS: Record<SyncJobStatus, string> = {
  QUEUED: 'Queued',
  PROCESSING: 'Processing',
  RETRY_SCHEDULED: 'Retry scheduled',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  FAILED_REQUIRES_ATTENTION: 'Needs attention',
};

const STATUS_ORDER: SyncJobStatus[] = [
  'QUEUED',
  'PROCESSING',
  'RETRY_SCHEDULED',
  'FAILED_REQUIRES_ATTENTION',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
];

const LOG_LEVEL_STYLES: Record<string, string> = {
  INFO: 'text-slate-500',
  WARN: 'text-amber-700',
  ERROR: 'text-red-700',
};

function jobLabel(job: { job_type: string; platform: string; payload: Record<string, unknown> }): string {
  const propertyName = typeof job.payload?.property_name === 'string' ? job.payload.property_name : null;
  const base = `${job.job_type} (${job.platform})`;
  return propertyName ? `${base} — ${propertyName}` : base;
}

export default async function AutomationCenterPage() {
  const grants = await getMyPermissions();
  if (!canAny(grants, 'integrations.view')) redirect('/dashboard');
  const canRetry = canAny(grants, 'integrations.retry') || canAny(grants, 'integrations.manage');

  const supabase = await createClient();

  // Counted with a HEAD request per status (7 tiny COUNTs, each backed by
  // sync_jobs_status_next_retry_idx's leading `status` column) rather than
  // `select('status')` with no limit — sync_jobs has no retention/cleanup,
  // so it only ever grows, and pulling every row just to tally them in
  // Node would eventually mean shipping the entire job history over the
  // wire on every page load.
  const STATUS_LIST: SyncJobStatus[] = [
    'QUEUED',
    'PROCESSING',
    'RETRY_SCHEDULED',
    'SUCCESS',
    'FAILED',
    'CANCELLED',
    'FAILED_REQUIRES_ATTENTION',
  ];

  const [statusCounts, { data: deadLetterJobs, error: jobsError }, { data: logs }] = await Promise.all([
    Promise.all(
      STATUS_LIST.map((status) =>
        supabase.from('sync_jobs').select('*', { count: 'exact', head: true }).eq('status', status)
      )
    ),
    supabase
      .from('sync_jobs')
      .select('id, organization_id, job_type, platform, payload, last_error, attempt_count, created_at')
      .eq('status', 'FAILED_REQUIRES_ATTENTION')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('integration_logs')
      .select('id, organization_id, level, event, message, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const counts: Record<SyncJobStatus, number> = {
    QUEUED: 0,
    PROCESSING: 0,
    RETRY_SCHEDULED: 0,
    SUCCESS: 0,
    FAILED: 0,
    CANCELLED: 0,
    FAILED_REQUIRES_ATTENTION: 0,
  };
  STATUS_LIST.forEach((status, i) => {
    counts[status] = statusCounts[i].count ?? 0;
  });

  const orgIds = [
    ...new Set(
      [...(deadLetterJobs ?? []).map((j) => j.organization_id), ...(logs ?? []).map((l) => l.organization_id)].filter(
        (id): id is string => Boolean(id)
      )
    ),
  ];
  const { data: orgs } = orgIds.length ? await supabase.from('organizations').select('id, name').in('id', orgIds) : { data: [] };
  const orgNames = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Automation Center</h1>
        <p className="text-sm text-slate-500">
          Job queue health and activity across every integration — Google Sheets, Facebook, and internal
          notifications alike.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Job queue</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="rounded-md border border-slate-100 p-3">
              <p className="text-xl font-semibold text-slate-900">{counts[status]}</p>
              <p className="text-xs text-slate-500">{STATUS_LABELS[status]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Needs attention {deadLetterJobs && deadLetterJobs.length > 0 && `(${deadLetterJobs.length})`}
        </h2>
        {jobsError && <p className="text-sm text-red-600">{jobsError.message}</p>}
        {deadLetterJobs?.length ? (
          <ul className="divide-y divide-slate-100">
            {deadLetterJobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{jobLabel(job)}</p>
                  <p className="text-xs text-slate-500">
                    {job.organization_id ? (orgNames.get(job.organization_id) ?? 'Unknown org') : 'Platform-wide'} ·
                    attempt {job.attempt_count} · {new Date(job.created_at).toLocaleString()}
                  </p>
                  {job.last_error && <p className="text-xs text-red-600">{job.last_error}</p>}
                </div>
                {canRetry && <RetryButton jobId={job.id} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">Nothing needs attention right now.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent activity</h2>
        {logs?.length ? (
          <ul className="space-y-1.5 text-xs">
            {logs.map((log) => (
              <li key={log.id} className="flex items-start justify-between gap-3">
                <span className={LOG_LEVEL_STYLES[log.level] ?? 'text-slate-500'}>
                  {log.event}
                  {log.message ? ` — ${log.message}` : ''}
                  {log.organization_id && ` (${orgNames.get(log.organization_id) ?? 'Unknown org'})`}
                </span>
                <span className="shrink-0 text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">No activity yet.</p>
        )}
      </section>
    </div>
  );
}
