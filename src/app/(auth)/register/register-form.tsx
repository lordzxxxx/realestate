'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@/lib/auth/schemas';
import { REGISTRABLE_ACCOUNT_TYPES } from '@/lib/auth/account-types';
import { registerAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, FieldError } from '@/components/ui/input';

export function RegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    setServerError(null);
    const result = await registerAction(data);
    if (result?.error) setServerError(result.error);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" autoComplete="name" {...register('full_name')} />
        <FieldError message={errors.full_name?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          <FieldError message={errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="phone">Contact number</Label>
          <Input id="phone" type="tel" autoComplete="tel" {...register('phone')} />
          <FieldError message={errors.phone?.message} />
        </div>
      </div>

      <div>
        <Label htmlFor="account_type">Account type</Label>
        <Select id="account_type" defaultValue="" {...register('account_type')}>
          <option value="" disabled>
            Select account type
          </option>
          {REGISTRABLE_ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <FieldError message={errors.account_type?.message} />
      </div>

      <div>
        <Label htmlFor="organization_name">Organization / company (if applicable)</Label>
        <Input id="organization_name" {...register('organization_name')} />
      </div>

      <div>
        <Label htmlFor="messenger_contact">Facebook / Messenger (optional)</Label>
        <Input id="messenger_contact" {...register('messenger_contact')} />
      </div>

      <div>
        <Label htmlFor="address">Address (optional)</Label>
        <Input id="address" {...register('address')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          <FieldError message={errors.password?.message} />
        </div>
        <div>
          <Label htmlFor="confirm_password">Confirm password</Label>
          <Input
            id="confirm_password"
            type="password"
            autoComplete="new-password"
            {...register('confirm_password')}
          />
          <FieldError message={errors.confirm_password?.message} />
        </div>
      </div>

      <div className="flex items-start gap-2">
        <input
          id="terms_accepted"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-300"
          {...register('terms_accepted')}
        />
        <Label htmlFor="terms_accepted" className="mb-0 font-normal">
          I agree to the Terms of Service and Privacy Policy.
        </Label>
      </div>
      <FieldError message={errors.terms_accepted?.message} />

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
