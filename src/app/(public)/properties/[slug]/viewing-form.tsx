'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { viewingRequestSchema, type ViewingRequestInput } from '@/lib/public/inquiry-schemas';
import { createViewingRequestAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { CheckCircle2 } from 'lucide-react';

export function ViewingForm({ listingId }: { listingId: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ViewingRequestInput>({ resolver: zodResolver(viewingRequestSchema) });

  if (submitted) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <p>Your viewing request has been sent. We&apos;ll confirm a time with you soon.</p>
      </div>
    );
  }

  const onSubmit = async (data: ViewingRequestInput) => {
    setServerError(null);
    const result = await createViewingRequestAction(listingId, data);
    if (result?.error) setServerError(result.error);
    else setSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <div>
        <Label htmlFor="view-name">Name</Label>
        <Input id="view-name" {...register('name')} />
        <FieldError message={errors.name?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="view-phone">Phone</Label>
          <Input id="view-phone" {...register('phone')} />
          <FieldError message={errors.phone?.message} />
        </div>
        <div>
          <Label htmlFor="view-email">Email</Label>
          <Input id="view-email" type="email" {...register('email')} />
          <FieldError message={errors.email?.message} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="view-date">Preferred date</Label>
          <Input id="view-date" type="date" {...register('preferred_date')} />
        </div>
        <div>
          <Label htmlFor="view-time">Preferred time</Label>
          <Input id="view-time" placeholder="e.g. 2:00 PM" {...register('preferred_time')} />
        </div>
      </div>
      <div>
        <Label htmlFor="view-notes">Notes</Label>
        <textarea
          id="view-notes"
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          {...register('notes')}
        />
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" variant="secondary" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Schedule Viewing'}
      </Button>
    </form>
  );
}
