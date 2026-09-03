import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { upsertListingRow, type ListingRowData } from '@/lib/google/sheets';

// Section 77: "Never expose the cron endpoint publicly without
// authentication. Use secret verification." Vercel Cron sends
// `Authorization: Bearer $CRON_SECRET` automatically when a `CRON_SECRET`
// env var is configured on the project — this checks that same convention,
// so it works whether Vercel Cron or any other scheduler (a plain curl on
// a timer, GitHub Actions, etc.) is what ends up calling it.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed: never run unauthenticated
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

const STALE_AFTER_DAYS = 7;
const JOB_BATCH_SIZE = 20;

async function enqueueStaleListingReminders(supabase: ReturnType<typeof createServiceRoleClient>) {
  const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10); // one reminder per listing per day, not per 5-min tick

  const { data: staleListings } = await supabase
    .from('listings')
    .select('id, organization_id, property_name, listing_number, assigned_agent_id, created_by')
    .eq('status', 'AVAILABLE')
    .or(`last_verified_at.is.null,last_verified_at.lt.${cutoff}`);

  let enqueued = 0;
  for (const listing of staleListings ?? []) {
    const recipient = listing.assigned_agent_id ?? listing.created_by;
    if (!recipient) continue;

    const { data: eventId } = await supabase.rpc('create_automation_event', {
      p_organization_id: listing.organization_id,
      p_event_type: 'LISTING_VERIFICATION_DUE',
      p_resource_type: 'listing',
      p_resource_id: listing.id,
      p_actor_id: null,
      p_payload: { property_name: listing.property_name },
    });

    const { data: jobId } = await supabase.rpc('enqueue_notification_job', {
      p_user_id: recipient,
      p_organization_id: listing.organization_id,
      p_event_id: eventId ?? null,
      p_type: 'LISTING_VERIFICATION_DUE',
      p_title: 'Is this still available?',
      p_body: `${listing.property_name} (${listing.listing_number}) hasn't been verified in over ${STALE_AFTER_DAYS} days.`,
      p_link: `/listings/${listing.id}`,
      p_idempotency_suffix: `stale_reminder:${listing.id}:${today}`,
    });

    if (jobId) enqueued += 1;
  }

  return enqueued;
}

async function processSendNotificationJob(
  supabase: ReturnType<typeof createServiceRoleClient>,
  job: { id: string; payload: Record<string, unknown> }
) {
  const payload = job.payload as {
    user_id: string;
    organization_id: string | null;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
  };

  // Duplicate-safe even if this job is somehow processed twice (e.g. the
  // worker crashed after this insert but before complete_sync_job ran, and
  // reclaim_stuck_sync_jobs later retried it): notifications.sync_job_id is
  // UNIQUE, so a second insert for the same job is treated as already-sent
  // rather than a double notification.
  const { error } = await supabase.from('notifications').upsert(
    {
      user_id: payload.user_id,
      organization_id: payload.organization_id,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link,
      sync_job_id: job.id,
    },
    { onConflict: 'sync_job_id', ignoreDuplicates: true }
  );

  if (error) throw error;
}

interface SheetsUpsertRowPayload {
  spreadsheet_id: string;
  sheet_name: string;
  listing_id: string;
  listing_number: string;
  status: string;
  listing_type: string;
  property_type: string;
  property_name: string;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area: number | null;
  monthly_rent: number | null;
  selling_price: number | null;
  city: string | null;
  province: string | null;
  assigned_agent_name: string | null;
  last_verified_at: string | null;
  updated_at: string;
  slug: string;
}

function listingUrlFor(slug: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return siteUrl ? `${siteUrl}/properties/${slug}` : `/properties/${slug}`;
}

async function processSheetsUpsertRowJob(
  supabase: ReturnType<typeof createServiceRoleClient>,
  job: { id: string; organization_id: string | null; payload: Record<string, unknown> }
) {
  const payload = job.payload as unknown as SheetsUpsertRowPayload;
  if (!job.organization_id) throw new Error('SHEETS_UPSERT_ROW job is missing organization_id');

  // Section 27: "Use Listing ID as the stable mapping key." This lookup is
  // what turns a second sync of the same listing into an in-place update
  // instead of a second appended row.
  const { data: existingRecord } = await supabase
    .from('sheet_sync_records')
    .select('row_number')
    .eq('organization_id', job.organization_id)
    .eq('listing_id', payload.listing_id)
    .maybeSingle();

  const rowData: ListingRowData = {
    listingId: payload.listing_id,
    listingNumber: payload.listing_number,
    status: payload.status,
    listingType: payload.listing_type,
    propertyType: payload.property_type,
    propertyName: payload.property_name,
    bedrooms: payload.bedrooms,
    bathrooms: payload.bathrooms,
    floorArea: payload.floor_area,
    monthlyRent: payload.monthly_rent,
    sellingPrice: payload.selling_price,
    city: payload.city,
    province: payload.province,
    assignedAgentName: payload.assigned_agent_name,
    lastVerifiedAt: payload.last_verified_at,
    updatedAt: payload.updated_at,
    listingUrl: listingUrlFor(payload.slug),
  };

  const { rowNumber } = await upsertListingRow(
    payload.spreadsheet_id,
    payload.sheet_name,
    existingRecord?.row_number ?? null,
    rowData
  );

  const { error: recordError } = await supabase.from('sheet_sync_records').upsert(
    {
      organization_id: job.organization_id,
      listing_id: payload.listing_id,
      row_number: rowNumber,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,listing_id' }
  );
  if (recordError) throw recordError;

  // A prior job may have flagged the connection ERROR; a subsequent success
  // (transient API blip, now resolved) should clear that back to CONNECTED
  // rather than leaving a stale error banner in the settings UI.
  const { error: connectionError } = await supabase
    .from('google_sheet_connections')
    .update({
      status: 'CONNECTED',
      last_synced_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('organization_id', job.organization_id);
  if (connectionError) throw connectionError;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: reclaimedCount } = await supabase.rpc('reclaim_stuck_sync_jobs', { p_stuck_after: '10 minutes' });
  const staleRemindersEnqueued = await enqueueStaleListingReminders(supabase);

  const { data: jobs, error: claimError } = await supabase.rpc('claim_next_sync_jobs', { p_limit: JOB_BATCH_SIZE });
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    try {
      if (job.job_type === 'SEND_NOTIFICATION') {
        await processSendNotificationJob(supabase, job as { id: string; payload: Record<string, unknown> });
      } else if (job.job_type === 'SHEETS_UPSERT_ROW') {
        await processSheetsUpsertRowJob(supabase, job as { id: string; organization_id: string | null; payload: Record<string, unknown> });
      } else {
        // No handler yet for this job_type (e.g. a future FACEBOOK_CREATE_POST
        // before Phase 7 lands) — fail it through the normal retry/dead-letter
        // path rather than silently dropping it or crashing the batch.
        throw new Error(`No handler for job_type "${job.job_type}"`);
      }

      await supabase.rpc('complete_sync_job', { p_job_id: job.id, p_success: true });
      succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Surface the failure on the connection immediately rather than
      // waiting for full dead-letter (max_attempts) — the settings page
      // should show "last error" as soon as a sync actually fails, not
      // minutes later after 2-3 silent retries.
      if (job.job_type === 'SHEETS_UPSERT_ROW' && job.organization_id) {
        await supabase
          .from('google_sheet_connections')
          .update({ status: 'ERROR', last_checked_at: new Date().toISOString(), last_error: message })
          .eq('organization_id', job.organization_id);
      }

      await supabase.rpc('complete_sync_job', {
        p_job_id: job.id,
        p_success: false,
        p_error: message,
      });
      failed += 1;
    }
  }

  return NextResponse.json({
    reclaimed: reclaimedCount ?? 0,
    staleRemindersEnqueued,
    claimed: jobs?.length ?? 0,
    succeeded,
    failed,
  });
}
