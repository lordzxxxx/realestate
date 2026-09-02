/**
 * One-time bootstrap: promote an already-registered, email-confirmed user to
 * SUPER_ADMIN, and optionally create the company's primary organization.
 *
 * Why this has to be a script and not a UI button: every admin action in the
 * app (approving users, creating organizations, granting roles) requires an
 * existing privileged user to be logged in. The very first admin has no one
 * to approve them — this script uses the service role key (bypasses RLS) to
 * break that bootstrapping cycle exactly once per deployment.
 *
 * Usage:
 *   1. Register a normal account through the app's /register page and
 *      confirm its email.
 *   2. npx tsx scripts/bootstrap-admin.ts you@example.com "Main Realty Co"
 *      (the organization name is optional — omit it to skip creating one)
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in the
 * environment (.env.local is loaded automatically).
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

config({ path: '.env.local' });

async function main() {
  const email = process.argv[2];
  const organizationName = process.argv[3];

  if (!email) {
    console.error('Usage: npx tsx scripts/bootstrap-admin.ts <email> [organization name]');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // supabase-js has no "get user by email" — page through auth admin listUsers.
  let targetUserId: string | null = null;
  for (let page = 1; page <= 20 && !targetUserId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) targetUserId = match.id;
    if (data.users.length < 200) break;
  }

  if (!targetUserId) {
    console.error(`No auth user found for ${email}. Register the account and confirm its email first.`);
    process.exit(1);
  }

  let organizationId: string | null = null;
  if (organizationName) {
    const slug = organizationName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { data: existing } = await supabase.from('organizations').select('id').eq('slug', slug).maybeSingle();

    if (existing) {
      organizationId = existing.id;
      console.log(`Using existing organization "${organizationName}" (${organizationId})`);
    } else {
      const { data: org, error } = await supabase
        .from('organizations')
        .insert({ name: organizationName, slug })
        .select('id')
        .single();
      if (error) throw error;
      organizationId = org.id;
      console.log(`Created organization "${organizationName}" (${organizationId})`);
    }
  }

  // The shared Database['profiles']['Update'] type deliberately excludes
  // `status` — migration 0009 revokes column-level UPDATE on it for the
  // authenticated/anon Postgres roles the app's normal clients run as, so
  // that only set_profile_status() (SECURITY DEFINER) can change it. This
  // script runs as service_role, which was never revoked that privilege;
  // the cast reflects that it is intentionally bypassing the app-level type,
  // not working around a real restriction.
  const profileUpdate = { status: 'ACTIVE', organization_id: organizationId } as unknown as Database['public']['Tables']['profiles']['Update'];
  const { error: profileError } = await supabase.from('profiles').update(profileUpdate).eq('id', targetUserId);
  if (profileError) throw profileError;

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'SUPER_ADMIN')
    .single();
  if (roleError) throw roleError;

  // SUPER_ADMIN is granted globally (organization_id null) — it must apply
  // platform-wide, not just to whichever organization was just created.
  const { error: grantError } = await supabase
    .from('user_roles')
    .upsert({ user_id: targetUserId, role_id: role.id, organization_id: null }, { onConflict: 'user_id,role_id,organization_id' });
  if (grantError) throw grantError;

  console.log(`\n${email} is now an ACTIVE SUPER_ADMIN. Sign in at /login.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
