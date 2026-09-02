import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Building2, UserCheck } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** If set, the item is only shown when the user holds this permission (any org). */
  permission?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Organizations', href: '/organizations', icon: Building2, permission: 'organization.view' },
  { label: 'User Approvals', href: '/admin/approvals', icon: UserCheck, permission: 'user.approve' },
];
