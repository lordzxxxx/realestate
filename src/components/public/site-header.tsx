import Link from 'next/link';

const NAV = [
  { href: '/properties', label: 'Properties' },
  { href: '/for-rent', label: 'For Rent' },
  { href: '/for-sale', label: 'For Sale' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-base font-semibold tracking-tight text-slate-900">
          Real Estate OS
        </Link>
        <nav className="hidden items-center gap-6 sm:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/login"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Agent Login
        </Link>
      </div>
      <nav className="flex items-center gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2 sm:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="whitespace-nowrap text-sm font-medium text-slate-600">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
