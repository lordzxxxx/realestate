import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Building2, UserCheck, Home } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** If set, the item is only shown when the user holds ANY of these permissions (any org). */
  permissions?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Listings',
    href: '/listings',
    icon: Home,
    permissions: ['listing.read_own', 'listing.read_organization', 'listing.read_all'],
  },
  { label: 'Organizations', href: '/organizations', icon: Building2, permissions: ['organization.view'] },
  { label: 'User Approvals', href: '/admin/approvals', icon: UserCheck, permissions: ['user.approve'] },
];
