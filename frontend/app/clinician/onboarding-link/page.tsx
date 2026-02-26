'use client';

import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function OnboardingLinkContent() {
  const { userId, isLoaded } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const inviteToken = searchParams.get('invite_token');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId || !inviteToken) return;

    async function link() {
      try {
        const res = await fetch(
          `${API_URL}/clinicians/invite/${inviteToken}/accept`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clerkUserId: userId }),
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // If already accepted, just redirect to checklist
          if (body.message?.includes('already been accepted')) {
            router.replace('/checklist');
            return;
          }
          // If the email belongs to an admin account, show a specific error
          if (body.message?.includes('ADMIN_EMAIL_CONFLICT')) {
            throw new Error('ADMIN_EMAIL_CONFLICT');
          }
          throw new Error(body.message || 'Failed to link account');
        }

        // Success — redirect to clinician portal
        router.replace('/checklist');
      } catch (err: any) {
        setError(err.message);
      }
    }

    link();
  }, [isLoaded, userId, inviteToken, router]);

  if (error) {
    const isAdminConflict = error === 'ADMIN_EMAIL_CONFLICT';

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-slate-200 text-center">
          <AlertCircle className={`mx-auto h-12 w-12 mb-4 ${isAdminConflict ? 'text-amber-500' : 'text-red-500'}`} />
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            {isAdminConflict ? 'Admin Account Detected' : 'Something went wrong'}
          </h1>
          {isAdminConflict ? (
            <>
              <p className="text-sm text-slate-600 mb-2">
                This email is already associated with an <strong>admin account</strong>.
              </p>
              <p className="text-sm text-slate-500 mb-6">
                Admin and clinician accounts must use different emails. You can sign in to your admin dashboard directly, or ask your administrator to re-invite you using a different email address.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href="/sign-in"
                  className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
                >
                  Go to Admin Dashboard
                </Link>
                <p className="text-xs text-slate-400">
                  Need a separate clinician account? Contact your administrator.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-6">{error}</p>
              <Link
                href="/sign-in"
                className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
              >
                Go to Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!inviteToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-slate-200 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Missing Invite Token
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            No invite token was provided. Please use the link from your invite email.
          </p>
          <Link
            href="/sign-in"
            className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-500">Setting up your account...</p>
      </div>
    </div>
  );
}

export default function OnboardingLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="mt-4 text-sm text-slate-500">Loading...</p>
          </div>
        </div>
      }
    >
      <OnboardingLinkContent />
    </Suspense>
  );
}
