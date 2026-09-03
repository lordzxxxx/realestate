import Link from 'next/link';

/** Plain GET-link pagination — no client JS, bookmarkable/shareable URLs,
 * same philosophy as the public search pages (Phase 4). `buildHref` lets
 * each caller preserve its own other query params (a status tab, a
 * resource filter) while only changing `page`. */
export function Pagination({
  page,
  pageSize,
  total,
  buildHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-slate-500">
        Page {page} of {totalPages} ({total} total)
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className="rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">
            Previous
          </Link>
        ) : (
          <span className="rounded-md border border-slate-200 px-3 py-1 text-slate-300">Previous</span>
        )}
        {page < totalPages ? (
          <Link href={buildHref(page + 1)} className="rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">
            Next
          </Link>
        ) : (
          <span className="rounded-md border border-slate-200 px-3 py-1 text-slate-300">Next</span>
        )}
      </div>
    </div>
  );
}
