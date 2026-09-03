import { z } from 'zod';

export const listingContactSchema = z.object({
  contact_type: z.enum(['OWNER', 'KEY_HOLDER', 'REPRESENTATIVE']),
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().toLowerCase().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  messenger: z.string().trim().max(200).optional().or(z.literal('')),
  company: z.string().trim().max(200).optional().or(z.literal('')),
  viewing_instructions: z.string().trim().max(1000).optional().or(z.literal('')),
  access_instructions: z.string().trim().max(1000).optional().or(z.literal('')),
  internal_notes: z.string().trim().max(2000).optional().or(z.literal('')),
  commission_info: z.string().trim().max(500).optional().or(z.literal('')),
});

export type ListingContactInput = z.infer<typeof listingContactSchema>;
