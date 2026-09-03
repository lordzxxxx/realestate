import { PropertyCard } from './property-card';
import { SearchForm } from './search-form';
import { parseSearchFilters } from '@/lib/public/filters';
import { searchPublicListings } from '@/lib/public/queries';
import type { ListingType } from '@/types/database';

const PAGE_SIZE = 24;

export async function PropertyListingPage({
  title,
  action,
  forcedType,
  searchParams,
}: {
  title: string;
  action: string;
  forcedType?: ListingType;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseSearchFilters(searchParams, forcedType ? { listingType: forcedType } : undefined);
  if (forcedType) filters.listingType = forcedType;

  const page = Math.max(1, Number(searchParams.page) || 1);
  const { listings, count } = await searchPublicListings(filters, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">
          {count} propert{count === 1 ? 'y' : 'ies'} found
        </p>
      </div>

      <SearchForm action={action} filters={filters} />

      {listings.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <PropertyCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          No properties match your search.
        </p>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`${action}?${new URLSearchParams({ ...toStringParams(searchParams), page: String(p) }).toString()}`}
              className={`rounded px-3 py-1 ${p === page ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              {p}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

function toStringParams(searchParams: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'page') continue;
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}
