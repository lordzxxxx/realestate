import { PROPERTY_TYPES, FURNISHING_TYPES } from '@/lib/listings/constants';
import type { PropertySearchFilters } from '@/lib/public/filters';

/**
 * Plain GET form — no client JS required, works on slow mobile connections,
 * and the resulting URL is shareable/bookmarkable. `action` lets the same
 * component serve /properties, /for-rent, and /for-sale.
 */
export function SearchForm({ action, filters }: { action: string; filters: PropertySearchFilters }) {
  return (
    <form action={action} method="GET" className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
      <input
        type="text"
        name="q"
        placeholder="Property name"
        defaultValue={filters.q}
        className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-1"
      />
      <select name="type" defaultValue={filters.listingType ?? ''} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
        <option value="">Rent or Sale</option>
        <option value="RENT">For Rent</option>
        <option value="SALE">For Sale</option>
      </select>
      <select name="propertyType" defaultValue={filters.propertyType ?? ''} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
        <option value="">Any Property Type</option>
        {PROPERTY_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        name="city"
        placeholder="City"
        defaultValue={filters.city}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        type="number"
        name="bedrooms"
        min={0}
        placeholder="Min bedrooms"
        defaultValue={filters.bedrooms}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <select name="furnishing" defaultValue={filters.furnishing ?? ''} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
        <option value="">Any Furnishing</option>
        {FURNISHING_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        name="minPrice"
        min={0}
        placeholder="Min price"
        defaultValue={filters.minPrice}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        type="number"
        name="maxPrice"
        min={0}
        placeholder="Max price"
        defaultValue={filters.maxPrice}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <select name="sort" defaultValue={filters.sort} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
        <option value="newest">Newest</option>
        <option value="price_low">Price: Low to High</option>
        <option value="price_high">Price: High to Low</option>
        <option value="recently_verified">Recently Verified</option>
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="availableOnly" value="1" defaultChecked={filters.availableOnly} className="h-4 w-4 rounded border-slate-300" />
        Available only
      </label>
      <button
        type="submit"
        className="col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:col-span-1"
      >
        Search
      </button>
    </form>
  );
}
