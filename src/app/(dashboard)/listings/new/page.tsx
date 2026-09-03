import Link from 'next/link';
import { FileText, ClipboardPaste } from 'lucide-react';

export default function NewListingChoicePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Add Property</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/listings/new/manual"
          className="rounded-lg border border-slate-200 bg-white p-6 transition-colors hover:border-slate-400"
        >
          <FileText className="mb-3 h-6 w-6 text-slate-400" strokeWidth={1.5} />
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Manual Form</h2>
          <p className="text-sm text-slate-500">Fill in property details field by field.</p>
        </Link>
        <Link
          href="/listings/new/paste"
          className="rounded-lg border border-slate-200 bg-white p-6 transition-colors hover:border-slate-400"
        >
          <ClipboardPaste className="mb-3 h-6 w-6 text-slate-400" strokeWidth={1.5} />
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Paste Property Details</h2>
          <p className="text-sm text-slate-500">
            Paste text from a message or listing sheet — we&apos;ll extract the details for you to review.
          </p>
        </Link>
      </div>
    </div>
  );
}
