'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@/lib/auth/schemas';

export interface ActionResult {
  error?: string;
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
