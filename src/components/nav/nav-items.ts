import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Building2,
  UserCheck,
  Home,
  ClipboardCheck,
  MessageSquare,
  CalendarClock,
  BarChart3,
  ScrollText,
  Workflow,
} from 'lucide-react';

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
  {
    label: 'Listing Approvals',
    href: '/admin/listing-approvals',
    icon: ClipboardCheck,
    permissions: ['listing.approve'],
  },
  {
    label: 'Inquiries',
    href: '/inquiries',
    icon: MessageSquare,
    permissions: ['inquiry.view_own', 'inquiry.view_organization', 'inquiry.view_all'],
  },
  { label: 'Viewings', href: '/viewings', icon: CalendarClock, permissions: ['viewing.view', 'viewing.manage'] },
  {
    label: 'Reports',
    href: '/reports',
    icon: BarChart3,
    permissions: ['reports.view_own', 'reports.view_organization', 'reports.view_all'],
  },
  { label: 'Organizations', href: '/organizations', icon: Building2, permissions: ['organization.view'] },
  { label: 'User Approvals', href: '/admin/approvals', icon: UserCheck, permissions: ['user.approve'] },
  { label: 'Audit Log', href: '/admin/audit', icon: ScrollText, permissions: ['audit.view'] },
  { label: 'Automation Center', href: '/admin/automation', icon: Workflow, permissions: ['integrations.view'] },
];
