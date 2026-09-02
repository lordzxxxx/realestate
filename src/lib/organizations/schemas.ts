import { z } from 'zod';

export const organizationSchema = z.object({
  name: z.string().trim().min(2, 'Organization name is required').max(200),
  contact_email: z.string().trim().toLowerCase().email('Enter a valid email').optional().or(z.literal('')),
  contact_phone: z.string().trim().max(50).optional().or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;

export const organizationSettingsSchema = z.object({
  auto_approve_registrations: z.boolean(),
  listing_approval_required: z.boolean(),
  auto_publish_website: z.boolean(),
  auto_publish_facebook: z.boolean(),
  auto_sync_google_sheets: z.boolean(),
});

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
