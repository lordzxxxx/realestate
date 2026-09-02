import Link from 'next/link';
import { RegisterForm } from './register-form';

export default function RegisterPage() {
  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-slate-900">Create an account</h2>
      <p className="mb-6 text-sm text-slate-500">
        For agents, brokers, property owners, key holders, and partner businesses.
      </p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-slate-900 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
