import 'server-only';
import { google, type sheets_v4 } from 'googleapis';

// Phase 6 (sections 25-28, 52): a single platform-level service account
// authenticates every organization's Sheets sync — no per-org OAuth
// authorization-code flow or refresh tokens. An org "connects" by pasting
// its spreadsheet ID and sharing edit access with this service account's
// email address (getServiceAccountEmail(), surfaced in the settings UI).
//
// Inert until GOOGLE_SERVICE_ACCOUNT_KEY is actually configured — every
// export here throws a clear error in that case rather than silently
// no-op'ing, so a misconfigured deployment fails loudly instead of quietly
// dropping every sync.

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// Column order is the contract between this file and the worker
// (src/app/api/cron/process-jobs/route.ts) — keep ROW_HEADER and
// listingToRowValues() in sync with each other.
const ROW_HEADER = [
  'Listing ID',
  'Listing Number',
  'Status',
  'Listing Type',
  'Property Type',
  'Property Name',
  'Bedrooms',
  'Bathrooms',
  'Floor Area (sqm)',
  'Monthly Rent',
  'Selling Price',
  'City',
  'Province',
  'Assigned Agent',
  'Last Verified',
  'Updated At',
  'Listing URL',
];

// A1:Q — must have exactly as many columns as ROW_HEADER.
const LAST_COLUMN = 'Q';

export interface ListingRowData {
  listingId: string;
  listingNumber: string;
  status: string;
  listingType: string;
  propertyType: string;
  propertyName: string;
  bedrooms: number | null;
  bathrooms: number | null;
  floorArea: number | null;
  monthlyRent: number | null;
  sellingPrice: number | null;
  city: string | null;
  province: string | null;
  assignedAgentName: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string;
  listingUrl: string;
}

function listingToRowValues(data: ListingRowData): (string | number)[] {
  return [
    data.listingId,
    data.listingNumber,
    data.status,
    data.listingType,
    data.propertyType,
    data.propertyName,
    data.bedrooms ?? '',
    data.bathrooms ?? '',
    data.floorArea ?? '',
    data.monthlyRent ?? '',
    data.sellingPrice ?? '',
    data.city ?? '',
    data.province ?? '',
    data.assignedAgentName ?? '',
    data.lastVerifiedAt ?? '',
    data.updatedAt,
    data.listingUrl,
  ];
}

function a1Range(sheetName: string, cellRange: string): string {
  // Sheet names can contain spaces (default 'Property Master Directory'),
  // so they must always be single-quoted in A1 notation.
  return `'${sheetName}'!${cellRange}`;
}

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

function readServiceAccountCredentials(): ServiceAccountCredentials {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  }

  let parsed: Partial<ServiceAccountCredentials>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email or private_key');
  }

  return {
    client_email: parsed.client_email,
    // Service account JSON downloaded from Google Cloud has real newlines;
    // pasting it into a single-line env var usually escapes them as "\n".
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
  };
}

/** For the settings UI: "share your spreadsheet with this email". Returns
 * null instead of throwing so the page can render a setup instruction
 * instead of crashing when credentials aren't configured yet. */
export function getServiceAccountEmail(): string | null {
  try {
    return readServiceAccountCredentials().client_email;
  } catch {
    return null;
  }
}

let cachedClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const { client_email, private_key } = readServiceAccountCredentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: [SHEETS_SCOPE],
  });

  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

function describeGoogleApiError(err: unknown): string {
  if (err && typeof err === 'object') {
    const withResponse = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
    const apiMessage = withResponse.response?.data?.error?.message;
    if (apiMessage) return apiMessage;
    if (withResponse.message) return withResponse.message;
  }
  return 'Unknown Google Sheets API error';
}

async function ensureHeaderRow(spreadsheetId: string, sheetName: string): Promise<void> {
  const sheets = getSheetsClient();

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: a1Range(sheetName, '1:1'),
  });

  const firstRow = data.values?.[0];
  if (firstRow && firstRow.length > 0) return; // Never clobber an existing header (or any content already there).

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: a1Range(sheetName, 'A1'),
    valueInputOption: 'RAW',
    requestBody: { values: [ROW_HEADER] },
  });
}

export interface SheetsConnectionTestResult {
  ok: boolean;
  error?: string;
}

/** Used by the settings UI's "Test connection" action: confirms the service
 * account can actually reach the spreadsheet and that the named sheet/tab
 * exists, and writes the header row on first success. Never throws — every
 * failure mode comes back as { ok: false, error }. */
export async function testSheetsConnection(spreadsheetId: string, sheetName: string): Promise<SheetsConnectionTestResult> {
  try {
    const sheets = getSheetsClient();

    const { data } = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const titles = (data.sheets ?? []).map((s) => s.properties?.title).filter((t): t is string => Boolean(t));

    if (!titles.includes(sheetName)) {
      return {
        ok: false,
        error: `No tab named "${sheetName}" in this spreadsheet. Tabs found: ${titles.join(', ') || '(none)'}`,
      };
    }

    await ensureHeaderRow(spreadsheetId, sheetName);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeGoogleApiError(err) };
  }
}

export interface UpsertRowResult {
  rowNumber: number;
}

/** Section 27: "Use Listing ID as the stable mapping key. Do NOT keep
 * appending duplicates." `knownRowNumber` comes from `sheet_sync_records` —
 * pass it when this listing already occupies a row (updates in place),
 * omit it (null) to append a new row and learn its row number. */
export async function upsertListingRow(
  spreadsheetId: string,
  sheetName: string,
  knownRowNumber: number | null,
  row: ListingRowData
): Promise<UpsertRowResult> {
  const sheets = getSheetsClient();
  const values = [listingToRowValues(row)];

  if (knownRowNumber) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: a1Range(sheetName, `A${knownRowNumber}:${LAST_COLUMN}${knownRowNumber}`),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
    return { rowNumber: knownRowNumber };
  }

  await ensureHeaderRow(spreadsheetId, sheetName);

  const append = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: a1Range(sheetName, `A:${LAST_COLUMN}`),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  const updatedRange = append.data.updates?.updatedRange ?? '';
  const match = updatedRange.match(/![A-Z]+(\d+):/);
  const rowNumber = match ? parseInt(match[1], 10) : NaN;
  if (!Number.isFinite(rowNumber)) {
    throw new Error(`Could not determine the appended row number from range "${updatedRange}"`);
  }

  return { rowNumber };
}
