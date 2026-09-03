'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { canAny, type PermissionGrant } from '@/lib/auth/permission-utils';
import { NAV_ITEMS } from './nav-items';

export function Sidebar({ grants }: { grants: PermissionGrant[] }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) => !item.permissions || item.permissions.some((p) => canAny(grants, p))
  );

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white px-3 py-4">
      <div className="mb-4 px-2 text-sm font-semibold tracking-tight text-slate-900">Real Estate OS</div>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
