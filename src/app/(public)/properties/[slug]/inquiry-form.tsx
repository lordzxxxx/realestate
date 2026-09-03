'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inquirySchema, type InquiryInput } from '@/lib/public/inquiry-schemas';
import { createInquiryAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, FieldError } from '@/components/ui/input';
import { CheckCircle2 } from 'lucide-react';

export function InquiryForm({ listingId }: { listingId: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InquiryInput>({ resolver: zodResolver(inquirySchema) });

  if (submitted) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <p>Thanks! Your inquiry has been sent. Someone will reach out to you shortly.</p>
      </div>
    );
  }

  const onSubmit = async (data: InquiryInput) => {
    setServerError(null);
    const result = await createInquiryAction(listingId, data);
    if (result?.error) setServerError(result.error);
    else setSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <div>
        <Label htmlFor="inq-name">Name</Label>
        <Input id="inq-name" {...register('name')} />
        <FieldError message={errors.name?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="inq-phone">Phone</Label>
          <Input id="inq-phone" {...register('phone')} />
          <FieldError message={errors.phone?.message} />
        </div>
        <div>
          <Label htmlFor="inq-email">Email</Label>
          <Input id="inq-email" type="email" {...register('email')} />
          <FieldError message={errors.email?.message} />
        </div>
      </div>
      <div>
        <Label htmlFor="inq-method">Preferred contact method</Label>
        <Select id="inq-method" defaultValue="" {...register('preferred_contact_method')}>
          <option value="">No preference</option>
          <option value="PHONE">Phone</option>
          <option value="EMAIL">Email</option>
          <option value="MESSENGER">Messenger</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="inq-message">Message</Label>
        <textarea
          id="inq-message"
          rows={3}
          placeholder="Is this still available?"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          {...register('message')}
        />
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send Inquiry'}
      </Button>
    </form>
  );
}
