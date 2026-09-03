'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { listingContactSchema, type ListingContactInput } from '@/lib/listings/contact-schema';
import { createListingContactAction, updateListingContactAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, FieldError } from '@/components/ui/input';

const CONTACT_TYPES = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'KEY_HOLDER', label: 'Key Holder' },
  { value: 'REPRESENTATIVE', label: 'Representative' },
] as const;

export function ContactForm({
  listingId,
  contactId,
  defaultValues,
  onDone,
}: {
  listingId: string;
  contactId?: string;
  defaultValues?: Partial<ListingContactInput>;
  onDone?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ListingContactInput>({
    resolver: zodResolver(listingContactSchema),
    defaultValues: { contact_type: 'OWNER', ...defaultValues },
  });

  const onSubmit = async (data: ListingContactInput) => {
    setServerError(null);
    const result = contactId
      ? await updateListingContactAction(listingId, contactId, data)
      : await createListingContactAction(listingId, data);
    if (result?.error) setServerError(result.error);
    else onDone?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="contact_type">Type</Label>
          <Select id="contact_type" {...register('contact_type')}>
            {CONTACT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register('name')} />
          <FieldError message={errors.name?.message} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register('phone')} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} />
          <FieldError message={errors.email?.message} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="messenger">Messenger</Label>
          <Input id="messenger" {...register('messenger')} />
        </div>
        <div>
          <Label htmlFor="company">Company</Label>
          <Input id="company" {...register('company')} />
        </div>
      </div>
      <div>
        <Label htmlFor="viewing_instructions">Viewing instructions</Label>
        <Input id="viewing_instructions" {...register('viewing_instructions')} />
      </div>
      <div>
        <Label htmlFor="access_instructions">Access instructions</Label>
        <Input id="access_instructions" {...register('access_instructions')} />
      </div>
      <div>
        <Label htmlFor="internal_notes">Internal notes</Label>
        <Input id="internal_notes" {...register('internal_notes')} />
      </div>
      <div>
        <Label htmlFor="commission_info">Commission info</Label>
        <Input id="commission_info" {...register('commission_info')} />
      </div>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : contactId ? 'Save changes' : 'Add contact'}
      </Button>
    </form>
  );
}
