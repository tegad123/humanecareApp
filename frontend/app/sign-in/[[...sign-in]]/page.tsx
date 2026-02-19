import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { CredentisLogo } from '@/components/logo';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-5">
            <CredentisLogo className="w-10 h-10" />
            <span className="font-bold text-xl text-slate-900">Credentis</span>
          </Link>
          <h1 className="text-xl font-bold text-slate-900 mb-1.5">Sign in to Credentis</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Credentis is invite-only for agencies. Sign in with the email your
            administrator used to invite you.
          </p>
        </div>

        <SignIn />

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an invitation?{' '}
          <Link href="/request-access" className="text-primary-600 hover:text-primary-700 font-medium">
            Request Access
          </Link>
        </p>
      </div>
    </div>
  );
}
