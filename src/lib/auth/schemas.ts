import { z } from 'zod';
import { ACCOUNT_TYPE_VALUES } from './account-types';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

const phoneRegex = /^[0-9+().\-\s]{7,20}$/;

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Full name is required').max(200),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    phone: z.string().trim().regex(phoneRegex, 'Enter a valid contact number'),
    account_type: z.enum(ACCOUNT_TYPE_VALUES, { message: 'Select an account type' }),
    organization_name: z.string().trim().max(200).optional().or(z.literal('')),
    messenger_contact: z.string().trim().max(200).optional().or(z.literal('')),
    address: z.string().trim().max(500).optional().or(z.literal('')),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
    terms_accepted: z.literal(true, {
      message: 'You must agree to the Terms of Service',
    }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
