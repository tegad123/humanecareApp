import { SignUp } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CredentisLogo } from '@/components/logo';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invite_token?: string; redirect_url?: string }>;
}) {
  const params = await searchParams;

  // Gate: only allow sign-up with a valid invite_token (clinician invite flow)
  if (!params.invite_token) {
    redirect('/sign-in');
  }

  const redirectUrl = params.redirect_url || undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-5">
            <CredentisLogo className="w-10 h-10" />
            <span className="font-bold text-xl text-slate-900">Credentis</span>
          </Link>
          <h1 className="text-xl font-bold text-slate-900 mb-1.5">Create Your Account</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Complete your sign-up to accept your invitation and access the
            clinician portal.
          </p>
        </div>

        <SignUp forceRedirectUrl={redirectUrl} />
      </div>
    </div>
  );
}
