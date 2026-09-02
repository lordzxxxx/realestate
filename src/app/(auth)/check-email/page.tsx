import { MailCheck } from 'lucide-react';

export default function CheckEmailPage() {
  return (
    <div className="text-center">
      <MailCheck className="mx-auto mb-4 h-10 w-10 text-slate-400" strokeWidth={1.5} />
      <h2 className="mb-1 text-xl font-semibold text-slate-900">Check your email</h2>
      <p className="text-sm text-slate-500">
        We sent a verification link to your email address. Confirm it to activate your account, then wait for
        management to approve your registration.
      </p>
    </div>
  );
}
