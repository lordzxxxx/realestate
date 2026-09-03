'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@/lib/auth/schemas';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export interface ActionResult {
  error?: string;
}

function rateLimitedMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Too many attempts from this connection. Please try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host');
  return `${proto}://${host}`;
}

export async function loginAction(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // 10 attempts per 10 minutes per IP — blunts credential-stuffing/brute
  // force against a single account without needing to know which account
  // is being targeted (a per-email limit would leak whether an email is
  // registered by behaving differently for existing vs. nonexistent ones).
  const loginRateLimit = checkRateLimit(`login:${await getClientIp()}`, 10, 10 * 60 * 1000);
  if (!loginRateLimit.allowed) return { error: rateLimitedMessage(loginRateLimit.retryAfterSeconds ?? 60) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message === 'Invalid login credentials' ? 'Incorrect email or password' : error.message };
  }

  redirect('/dashboard');
}

export async function registerAction(input: RegisterInput): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // 5 registrations per hour per IP — registration spam is more costly
  // than a login attempt (each one creates a real pending profile someone
  // has to review, per the approval workflow), so a longer window than
  // login's.
  const registerRateLimit = checkRateLimit(`register:${await getClientIp()}`, 5, 60 * 60 * 1000);
  if (!registerRateLimit.allowed) return { error: rateLimitedMessage(registerRateLimit.retryAfterSeconds ?? 60) };

  const { email, password, full_name, phone, account_type, organization_name, messenger_contact, address } =
    parsed.data;

  const supabase = await createClient();
  const origin = await siteOrigin();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name,
        phone,
        user_category: account_type,
        organization_name: organization_name || null,
        messenger_contact: messenger_contact || null,
        address: address || null,
        terms_accepted: 'true',
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/check-email');
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
