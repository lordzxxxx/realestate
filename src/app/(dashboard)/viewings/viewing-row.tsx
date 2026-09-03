'use client';

import { useState, useTransition } from 'react';
import { updateViewingAction } from './actions';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import type { Database, ViewingStatus } from '@/types/database';

type Viewing = Database['public']['Tables']['viewing_requests']['Row'];

const STATUS_OPTIONS: ViewingStatus[] = ['REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED'];

export function ViewingRow({ viewing, listingLabel }: { viewing: Viewing; listingLabel: string }) {
  const [status, setStatus] = useState(viewing.status);
  const [notes, setNotes] = useState(viewing.notes ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateViewingAction(viewing.id, { status, notes });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{viewing.name}</p>
          <p className="text-xs text-slate-500">
            {[viewing.phone, viewing.email].filter(Boolean).join(' · ')} · {listingLabel}
          </p>
          {(viewing.preferred_date || viewing.preferred_time) && (
            <p className="mt-1 text-xs text-slate-600">
              Requested: {viewing.preferred_date ?? '—'} {viewing.preferred_time ?? ''}
            </p>
          )}
          {viewing.notes && <p className="text-xs text-slate-500">{viewing.notes}</p>}
        </div>
        <p className="shrink-0 text-xs text-slate-400">{new Date(viewing.created_at).toLocaleDateString()}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value as ViewingStatus)} className="w-auto">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
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
