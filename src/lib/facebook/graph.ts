import 'server-only';
import { formatCurrency } from '@/lib/listings/constants';

// Phase 7 (sections 25-28, 52): posts to a single organization's Facebook
// Page using that org's own long-lived Page Access Token (pasted in by an
// admin — see migration 0025's header comment for why this isn't a full
// OAuth flow). Plain fetch calls to the Graph API's REST endpoints — no SDK
// dependency needed, since every call here is a simple form-encoded POST or
// a query-string GET.
//
// Inert until a real Page ID + token are configured per organization: every
// export either fails with the Graph API's own error message or, with no
// token at all, never gets called (the settings UI has nothing to submit).

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

function describeGraphError(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const message = (body as GraphErrorBody).error?.message;
    if (message) return message;
  }
  return fallback;
}

export interface PageConnectionTestResult {
  ok: boolean;
  pageName?: string;
  error?: string;
}

/** Used by the settings UI's "Test connection" action: confirms the token
 * actually authorizes posting as this specific Page (a token for a
 * *different* page a user manages would otherwise look superficially
 * valid). Never throws — every failure mode comes back as
 * { ok: false, error }. */
export async function testPageConnection(pageId: string, accessToken: string): Promise<PageConnectionTestResult> {
  try {
    const url = new URL(`${GRAPH_API_BASE}/${encodeURIComponent(pageId)}`);
    url.searchParams.set('fields', 'id,name');
    url.searchParams.set('access_token', accessToken);

    const response = await fetch(url.toString());
    const body = await response.json();

    if (!response.ok || body.error) {
      return { ok: false, error: describeGraphError(body, `Graph API request failed (${response.status})`) };
    }
    if (body.id !== pageId) {
      return { ok: false, error: `This token resolves to a different Page (${body.id}), not ${pageId}.` };
    }

    return { ok: true, pageName: typeof body.name === 'string' ? body.name : undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error contacting the Facebook Graph API' };
  }
}

export interface ListingPostData {
  propertyName: string;
  listingNumber: string;
  status: string;
  listingType: string;
  monthlyRent: number | null;
  sellingPrice: number | null;
  city: string | null;
  province: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  listingUrl: string;
}

// Column order/shape is deliberately similar to Phase 6's ListingRowData —
// same source data, different destination. Kept separate rather than
// shared because a spreadsheet row and a social post have very different
// formatting needs (this builds prose, not columns).
function buildMessage(data: ListingPostData): string {
  const priceText =
    data.listingType === 'RENT'
      ? data.monthlyRent != null
        ? `${formatCurrency(data.monthlyRent)}/month`
        : null
      : data.sellingPrice != null
        ? formatCurrency(data.sellingPrice)
        : null;

  const location = [data.city, data.province].filter(Boolean).join(', ');
  const specs = [data.bedrooms != null ? `${data.bedrooms} BR` : null, data.bathrooms != null ? `${data.bathrooms} BA` : null]
    .filter(Boolean)
    .join(' · ');

  // AVAILABLE is the default/expected state for anything worth posting —
  // only call out status when it's something a follower should notice
  // (already reserved/rented/sold, or temporarily off the market).
  const statusPrefix = data.status !== 'AVAILABLE' ? `[${data.status}] ` : '';

  return [`${statusPrefix}${data.propertyName}`, [priceText, location, specs].filter(Boolean).join(' | '), `Ref: ${data.listingNumber}`]
    .filter(Boolean)
    .join('\n');
}

export interface UpsertPostResult {
  postId: string;
}

async function createPagePost(pageId: string, accessToken: string, data: ListingPostData): Promise<UpsertPostResult> {
  const body = new URLSearchParams({
    message: buildMessage(data),
    link: data.listingUrl,
    access_token: accessToken,
  });

  const response = await fetch(`${GRAPH_API_BASE}/${encodeURIComponent(pageId)}/feed`, { method: 'POST', body });
  const json = await response.json();

  if (!response.ok || json.error || typeof json.id !== 'string') {
    throw new Error(describeGraphError(json, `Failed to create Facebook post (${response.status})`));
  }

  return { postId: json.id };
}

async function updatePagePost(postId: string, accessToken: string, data: ListingPostData): Promise<void> {
  const body = new URLSearchParams({
    message: buildMessage(data),
    access_token: accessToken,
  });

  const response = await fetch(`${GRAPH_API_BASE}/${encodeURIComponent(postId)}`, { method: 'POST', body });
  const json = await response.json();

  if (!response.ok || json.error || json.success === false) {
    throw new Error(describeGraphError(json, `Failed to update Facebook post (${response.status})`));
  }
}

/** Section 27's "stable mapping key" idea, applied to Facebook: pass the
 * post ID from `facebook_post_records` when this listing already has a
 * post (edits its message in place — a link post's attached link/preview
 * can't be swapped after creation, so only the caption changes), omit it
 * (null) to create a brand-new post and learn its ID. */
export async function upsertListingPost(
  pageId: string,
  accessToken: string,
  knownPostId: string | null,
  data: ListingPostData
): Promise<UpsertPostResult> {
  if (knownPostId) {
    await updatePagePost(knownPostId, accessToken, data);
    return { postId: knownPostId };
  }
  return createPagePost(pageId, accessToken, data);
}
