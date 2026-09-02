import Link from 'next/link';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-slate-900">Sign in</h2>
      <p className="mb-6 text-sm text-slate-500">Access your real estate management dashboard.</p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-slate-500">
        New here?{' '}
        <Link href="/register" className="font-medium text-slate-900 hover:underline">
          Register an account
        </Link>
      </p>
    </div>
  );
}
