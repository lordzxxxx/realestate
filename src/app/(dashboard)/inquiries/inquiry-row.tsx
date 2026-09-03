'use client';

import { useState, useTransition } from 'react';
import { updateInquiryAction } from './actions';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import type { Database, InquiryStatus } from '@/types/database';

type Inquiry = Database['public']['Tables']['inquiries']['Row'];

const STATUS_OPTIONS: InquiryStatus[] = [
  'NEW',
  'ASSIGNED',
  'CONTACTED',
  'VIEWING_SCHEDULED',
  'FOLLOW_UP',
  'CONVERTED',
  'LOST',
  'CLOSED',
];

export function InquiryRow({ inquiry, listingLabel }: { inquiry: Inquiry; listingLabel: string }) {
  const [status, setStatus] = useState(inquiry.status);
  const [notes, setNotes] = useState(inquiry.notes ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateInquiryAction(inquiry.id, { status, notes });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{inquiry.name}</p>
          <p className="text-xs text-slate-500">
            {[inquiry.phone, inquiry.email].filter(Boolean).join(' · ')} · {listingLabel}
          </p>
          {inquiry.message && <p className="mt-1 text-xs text-slate-600">&ldquo;{inquiry.message}&rdquo;</p>}
        </div>
        <p className="shrink-0 text-xs text-slate-400">{new Date(inquiry.created_at).toLocaleDateString()}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value as InquiryStatus)} className="w-auto">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </Select>
        <input
          type="text"
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <Button size="sm" disabled={isPending} onClick={save}>
          Save
        </Button>
        {saved && <span className="text-xs text-emerald-600">Saved</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
