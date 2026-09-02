import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PermissionGrant } from './permission-utils';

export { can, canAny, type PermissionGrant } from './permission-utils';

export class PermissionDeniedError extends Error {
  constructor(permission: string) {
    super(`Permission denied: ${permission}`);
    this.name = 'PermissionDeniedError';
  }
}

/** All permission grants for the current session, global and org-scoped. */
export async function getMyPermissions(): Promise<PermissionGrant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_permissions');
  if (error) throw error;
  return data ?? [];
}

/**
 * Authoritative single-permission check, delegated to the same SQL function
 * that backs every RLS policy — use this in server actions/route handlers
 * before performing an action that RLS itself won't fully gate (e.g. deciding
 * whether to even attempt an operation, or gating a read that isn't row-scoped).
 */
export async function hasPermission(permission: string, organizationId?: string | null): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('current_user_has_permission', {
    p_permission: permission,
    p_organization_id: organizationId ?? null,
  });
  if (error) throw error;
  return data ?? false;
}

/** Throws PermissionDeniedError if the current session lacks the permission. */
export async function requirePermission(permission: string, organizationId?: string | null): Promise<void> {
  if (!(await hasPermission(permission, organizationId))) {
    throw new PermissionDeniedError(permission);
  }
}
