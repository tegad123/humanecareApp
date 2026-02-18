'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { CredentisLogo } from '@/components/logo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface InviteInfo {
  clinicianId: string;
  firstName: string;
  lastName: string;
  email: string;
  discipline: string;
  organizationName: string;
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'expired' | 'accepted' | 'invalid'>('invalid');

  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch(`${API_URL}/clinicians/invite/${token}/validate`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const message = body.message || 'Invalid invite';
          if (message.includes('expired')) {
            setErrorType('expired');
          } else if (message.includes('already been accepted')) {
            setErrorType('accepted');
          }
          throw new Error(message);
        }
        setInvite(await res.json());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token]);

  const handleAccept = () => {
    if (!invite) return;
    const redirectUrl = `/clinician/onboarding-link?invite_token=${token}`;
    const params = new URLSearchParams({
      invite_token: token,
      redirect_url: redirectUrl,
    });
    router.push(`/sign-up?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-500">Validating your invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-slate-200 text-center">
          {errorType === 'accepted' ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h1 className="text-xl font-semibold text-slate-900 mb-2">
                Already Accepted
              </h1>
              <p className="text-sm text-slate-600 mb-6">
                You&apos;ve already accepted this invite and created your account.
              </p>
              <Link
                href="/sign-in"
                className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
              >
                Sign In
              </Link>
            </>
          ) : errorType === 'expired' ? (
            <>
              <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
              <h1 className="text-xl font-semibold text-slate-900 mb-2">
                Invite Expired
              </h1>
              <p className="text-sm text-slate-600 mb-6">
                This invite link has expired. Please contact your agency to request a new one.
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h1 className="text-xl font-semibold text-slate-900 mb-2">
                Invalid Invite
              </h1>
              <p className="text-sm text-slate-600 mb-6">
                This invite link is not valid. Please check the link or contact your agency.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-slate-200">
        <div className="text-center mb-6">
          <CredentisLogo className="mx-auto h-12 w-12 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome to Credentis
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            You&apos;ve been invited to complete your onboarding
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Name</span>
            <span className="font-medium text-slate-900">
              {invite!.firstName} {invite!.lastName}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Organization</span>
            <span className="font-medium text-slate-900">
              {invite!.organizationName}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Discipline</span>
            <span className="font-medium text-slate-900">
              {invite!.discipline}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-900">
              {invite!.email}
            </span>
          </div>
        </div>

        <button
          onClick={handleAccept}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Accept Invite &amp; Create Account
        </button>

        <p className="mt-4 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
