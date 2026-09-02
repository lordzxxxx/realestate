'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { organizationSchema, type OrganizationInput } from '@/lib/organizations/schemas';
import { createOrganizationAction, updateOrganizationAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';

export function OrganizationForm({
  organizationId,
  defaultValues,
}: {
  organizationId?: string;
  defaultValues?: Partial<OrganizationInput>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationInput>({ resolver: zodResolver(organizationSchema), defaultValues });

  const onSubmit = async (data: OrganizationInput) => {
    setServerError(null);
    setSaved(false);
    const result = organizationId
      ? await updateOrganizationAction(organizationId, data)
      : await createOrganizationAction(data);
    if (result?.error) setServerError(result.error);
    else if (organizationId) setSaved(true);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div>
        <Label htmlFor="name">Organization name</Label>
        <Input id="name" {...register('name')} />
        <FieldError message={errors.name?.message} />
      </div>
      <div>
        <Label htmlFor="contact_email">Contact email</Label>
        <Input id="contact_email" type="email" {...register('contact_email')} />
        <FieldError message={errors.contact_email?.message} />
      </div>
      <div>
        <Label htmlFor="contact_phone">Contact phone</Label>
        <Input id="contact_phone" {...register('contact_phone')} />
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Input id="address" {...register('address')} />
      </div>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {saved && <p className="text-sm text-emerald-600">Saved.</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : organizationId ? 'Save changes' : 'Create organization'}
      </Button>
    </form>
  );
}
