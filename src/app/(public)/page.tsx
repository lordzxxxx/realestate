import Link from 'next/link';
import { PropertyCard } from '@/components/public/property-card';
import { SearchForm } from '@/components/public/search-form';
import { parseSearchFilters } from '@/lib/public/filters';
import { getFeaturedListings } from '@/lib/public/queries';

export default async function HomePage() {
  const featured = await getFeaturedListings(8);
  const filters = parseSearchFilters({});

  return (
    <div>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-slate-900">Find your next place</h1>
          <p className="mb-6 text-sm text-slate-500">Browse available rentals and properties for sale.</p>
          <div className="mx-auto max-w-4xl text-left">
            <SearchForm action="/properties" filters={filters} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recently Added</h2>
          <Link href="/properties" className="text-sm text-slate-500 hover:underline">
            View all
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((listing) => (
              <PropertyCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
            No properties published yet.
          </p>
        )}
      </section>
    </div>
  );
}
