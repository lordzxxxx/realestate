import Link from 'next/link';
import { LogOut, Bell } from 'lucide-react';
import { logoutAction } from '@/app/(auth)/actions';
import type { Profile } from '@/lib/auth/session';

const CATEGORY_LABELS: Record<Profile['user_category'], string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin',
  MANAGEMENT: 'Management',
  COMPANY_AGENT: 'Company Agent',
  BROKER: 'Broker',
  EXTERNAL_AGENT: 'Agent',
  KEY_HOLDER: 'Key Holder',
  PROPERTY_OWNER: 'Property Owner',
  PROPERTY_REPRESENTATIVE: 'Property Representative',
  PARTNER_BUSINESS_ADMIN: 'Partner Business Admin',
  PARTNER_BUSINESS_MEMBER: 'Partner Business Member',
};

export function Topbar({ profile, unreadNotificationCount }: { profile: Profile; unreadNotificationCount: number }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <Link
          href="/notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadNotificationCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </span>
          )}
        </Link>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{profile.full_name}</p>
          <p className="text-xs text-slate-500">{CATEGORY_LABELS[profile.user_category]}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
