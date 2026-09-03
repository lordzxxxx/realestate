import { NextResponse } from 'next/server';
import { getMyPermissions } from '@/lib/auth/permissions';
import { canAny } from '@/lib/auth/permission-utils';
import { getListingsReport, getInquiriesCountsByStatus, getViewingsCountsByStatus } from '@/lib/reports/get-reports';
import { buildReportsCsv } from '@/lib/reports/to-csv';
import { LISTING_STATUS_LABELS } from '@/lib/listings/constants';

// reports.export is a distinct, narrower permission from reports.view_* —
// several seeded roles (COMPANY_AGENT, PARTNER_BUSINESS_MEMBER, BROKER) can
// view reports but were deliberately not granted export (0007), so this
// checks its own permission rather than assuming view access implies it.
export async function GET() {
  const grants = await getMyPermissions();
  if (!canAny(grants, 'reports.export')) {
    return NextResponse.json({ error: 'You do not have permission to export reports.' }, { status: 403 });
  }

  const [listings, inquiryCounts, viewingCounts] = await Promise.all([
    getListingsReport(),
    getInquiriesCountsByStatus(),
    getViewingsCountsByStatus(),
  ]);

  const csv = buildReportsCsv([
    {
      title: 'Listings by status',
      headers: ['Status', 'Count'],
      rows: Object.entries(listings.countsByStatus).map(([status, count]) => [
        LISTING_STATUS_LABELS[status as keyof typeof LISTING_STATUS_LABELS],
        count,
      ]),
    },
    {
      title: 'Active listing value',
      headers: ['Metric', 'Value'],
      rows: [
        ['For rent (monthly total)', listings.activeMonthlyRentValue],
        ['For sale (total)', listings.activeSellingPriceValue],
      ],
    },
    {
      title: 'Verification compliance',
      headers: ['Metric', 'Value'],
      rows: [
        ['Verified within 7 days', listings.verification.verified],
        ['Stale / never verified', listings.verification.stale],
        ['Compliance %', listings.verification.compliancePct ?? 'n/a'],
      ],
    },
    {
      title: 'Inquiries by status',
      headers: ['Status', 'Count'],
      rows: Object.entries(inquiryCounts),
    },
    {
      title: 'Viewings by status',
      headers: ['Status', 'Count'],
      rows: Object.entries(viewingCounts),
    },
  ]);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reports-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
