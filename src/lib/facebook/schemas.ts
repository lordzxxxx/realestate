import { z } from 'zod';

export const facebookPageConnectionSchema = z.object({
  page_id: z.string().trim().min(1, 'Page ID is required'),
  // Optional/blank means "leave the saved token as-is" — the server never
  // sends the real token back to the client to prefill this field (see
  // migration 0025's column-level SELECT revoke), so requiring it on every
  // save would force re-pasting the token just to change the Page ID.
  access_token: z.string().trim().optional(),
});

export type FacebookPageConnectionInput = z.infer<typeof facebookPageConnectionSchema>;
