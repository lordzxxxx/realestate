// Pure, framework-agnostic helpers — safe to import from client components
// (e.g. to decide whether to show a nav link). The authoritative checks live
// in permissions.ts (server-only) and, ultimately, in RLS/has_permission().

export type PermissionGrant = { permission_key: string; organization_id: string | null };

/**
 * Mirrors the SQL has_permission() semantics exactly: a global grant
 * (organization_id null) matches any organizationId; an org-scoped grant
 * only matches that same organization.
 */
export function can(grants: PermissionGrant[], permission: string, organizationId?: string | null): boolean {
  return grants.some(
    (g) =>
      g.permission_key === permission &&
      (g.organization_id === null || g.organization_id === (organizationId ?? null))
  );
}

/** True if the user holds this permission in ANY context — useful for nav visibility. */
export function canAny(grants: PermissionGrant[], permission: string): boolean {
  return grants.some((g) => g.permission_key === permission);
}
