import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyPermissions } from '@/lib/auth/permissions';
import { canAny } from '@/lib/auth/permission-utils';
import { getListingsReport, getInquiriesCountsByStatus, getViewingsCountsByStatus } from '@/lib/reports/get-reports';
import { LISTING_STATUS_LABELS, formatCurrency } from '@/lib/listings/constants';
import type { ListingStatus, InquiryStatus, ViewingStatus } from '@/types/database';

const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  CONTACTED: 'Contacted',
  VIEWING_SCHEDULED: 'Viewing Scheduled',
  FOLLOW_UP: 'Follow-up',
  CONVERTED: 'Converted',
  LOST: 'Lost',
  CLOSED: 'Closed',
};

const VIEWING_STATUS_LABELS: Record<ViewingStatus, string> = {
  REQUESTED: 'Requested',
  CONFIRMED: 'Confirmed',
  RESCHEDULED: 'Rescheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const LISTING_STATUS_ORDER: ListingStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'AVAILABLE',
  'RESERVED',
  'RENTED',
  'SOLD',
  'TEMPORARILY_UNAVAILABLE',
  'REJECTED',
  'ARCHIVED',
];

function CountTable({ rows }: { rows: { label: string; value: number }[] }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-slate-100 last:border-0">
            <td className="py-1.5 text-slate-600">{row.label}</td>
            <td className="py-1.5 text-right font-medium text-slate-900">{row.value}</td>
          </tr>
        ))}
        <tr>
          <td className="pt-1.5 font-semibold text-slate-900">Total</td>
          <td className="pt-1.5 text-right font-semibold text-slate-900">{total}</td>
        </tr>
      </tbody>
    </table>
  );
}

export default async function ReportsPage() {
  const grants = await getMyPermissions();
  const canView =
    canAny(grants, 'reports.view_own') || canAny(grants, 'reports.view_organization') || canAny(grants, 'reports.view_all');
  if (!canView) redirect('/dashboard');
  const canExport = canAny(grants, 'reports.export');

  const [listings, inquiryCounts, viewingCounts] = await Promise.all([
    getListingsReport(),
    getInquiriesCountsByStatus(),
    getViewingsCountsByStatus(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">
            Scoped to what you can see elsewhere in the app — your own listings, your organization&apos;s, or the
            whole platform, depending on your role.
          </p>
        </div>
        {canExport && (
          <Link href="/api/reports/export">
            <span className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50">
              Export CSV
            </span>
          </Link>
        )}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Listings by status</h2>
        <CountTable rows={LISTING_STATUS_ORDER.map((s) => ({ label: LISTING_STATUS_LABELS[s], value: listings.countsByStatus[s] }))} />
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Active listing value</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">For rent (monthly)</dt>
              <dd className="font-medium text-slate-900">{formatCurrency(listings.activeMonthlyRentValue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">For sale</dt>
              <dd className="font-medium text-slate-900">{formatCurrency(listings.activeSellingPriceValue)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">Sum of listed price across currently AVAILABLE listings.</p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Verification compliance</h2>
          {listings.verification.totalAvailable > 0 ? (
            <>
              <p className="text-2xl font-semibold text-slate-900">{listings.verification.compliancePct}%</p>
              <p className="text-xs text-slate-500">
                {listings.verification.verified} of {listings.verification.totalAvailable} available listings
                verified within the last 7 days
              </p>
              {listings.verification.stale > 0 && (
                <Link href="/listings?status=needs_verification" className="mt-2 inline-block text-xs text-slate-600 hover:underline">
                  {listings.verification.stale} need verification →
                </Link>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">No available listings yet.</p>
          )}
        </section>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Inquiries</h2>
          <CountTable
            rows={(Object.keys(INQUIRY_STATUS_LABELS) as InquiryStatus[]).map((s) => ({
              label: INQUIRY_STATUS_LABELS[s],
              value: inquiryCounts[s],
            }))}
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Viewings</h2>
          <CountTable
            rows={(Object.keys(VIEWING_STATUS_LABELS) as ViewingStatus[]).map((s) => ({
              label: VIEWING_STATUS_LABELS[s],
              value: viewingCounts[s],
            }))}
          />
        </section>
      </div>
    </div>
  );
}
