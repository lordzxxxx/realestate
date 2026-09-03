'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { InquiryForm } from './inquiry-form';
import { ViewingForm } from './viewing-form';

export function ContactCard({ listingId }: { listingId: string }) {
  const [tab, setTab] = useState<'inquire' | 'viewing'>('inquire');

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex gap-1 rounded-md bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab('inquire')}
          className={cn(
            'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'inquire' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          )}
        >
          Inquire
        </button>
        <button
          type="button"
          onClick={() => setTab('viewing')}
          className={cn(
            'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'viewing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          )}
        >
          Schedule Viewing
        </button>
      </div>
      {tab === 'inquire' ? <InquiryForm listingId={listingId} /> : <ViewingForm listingId={listingId} />}
    </div>
  );
}
