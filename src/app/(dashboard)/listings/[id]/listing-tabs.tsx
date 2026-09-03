'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Overview', suffix: '' },
  { label: 'Images', suffix: '/images' },
  { label: 'Contacts', suffix: '/contacts' },
  { label: 'History', suffix: '/history' },
];

export function ListingTabs({ listingId }: { listingId: string }) {
  const pathname = usePathname();
  const base = `/listings/${listingId}`;

  return (
    <nav className="flex gap-1 border-b border-slate-200">
      {TABS.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const active = pathname === href;
        return (
          <Link
            key={tab.suffix}
            href={href}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
