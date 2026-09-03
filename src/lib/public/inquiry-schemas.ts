import { z } from 'zod';

export const inquirySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    phone: z.string().trim().max(50).optional().or(z.literal('')),
    email: z.string().trim().toLowerCase().email('Enter a valid email').optional().or(z.literal('')),
    message: z.string().trim().max(2000).optional().or(z.literal('')),
    preferred_contact_method: z.enum(['PHONE', 'EMAIL', 'MESSENGER']).optional(),
  })
  .refine((data) => data.phone || data.email, {
    message: 'Provide a phone number or an email address',
    path: ['phone'],
  });

export type InquiryInput = z.infer<typeof inquirySchema>;

export const viewingRequestSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    phone: z.string().trim().max(50).optional().or(z.literal('')),
    email: z.string().trim().toLowerCase().email('Enter a valid email').optional().or(z.literal('')),
    preferred_date: z.string().trim().max(20).optional().or(z.literal('')),
    preferred_time: z.string().trim().max(50).optional().or(z.literal('')),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .refine((data) => data.phone || data.email, {
    message: 'Provide a phone number or an email address',
    path: ['phone'],
  });

export type ViewingRequestInput = z.infer<typeof viewingRequestSchema>;
