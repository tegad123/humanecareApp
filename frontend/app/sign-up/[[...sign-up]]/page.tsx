import { SignUp } from '@clerk/nextjs';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invite_token?: string; redirect_url?: string }>;
}) {
  const params = await searchParams;
  const redirectUrl = params.redirect_url || undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <SignUp
        forceRedirectUrl={redirectUrl}
      />
    </div>
  );
}
