import { z } from 'zod';

export const googleSheetsConnectionSchema = z.object({
  spreadsheet_id: z.string().trim().min(1, 'Paste a spreadsheet ID or URL'),
  property_sheet_name: z.string().trim().min(1, 'Sheet/tab name is required').max(200),
});

export type GoogleSheetsConnectionInput = z.infer<typeof googleSheetsConnectionSchema>;

/** Accepts either a bare spreadsheet ID or a full Google Sheets URL (the
 * common case: a user pastes the browser URL) and returns just the ID. */
export function extractSpreadsheetId(idOrUrl: string): string {
  const match = idOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : idOrUrl.trim();
}
