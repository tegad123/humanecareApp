'use client';

import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';
import { CredentisLogo } from '@/components/logo';

export default function NoAccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        <CredentisLogo className="w-12 h-12 mx-auto mb-6" />

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 6V15" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="14" cy="20" r="1.5" fill="#d97706" />
              <path d="M14 3L3 24H25L14 3Z" stroke="#d97706" strokeWidth="2" strokeLinejoin="round" fill="none" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-2">No Organization Access</h1>

          <p className="text-sm text-slate-600 leading-relaxed mb-2">
            Your account isn&apos;t associated with any agency on Credentis.
          </p>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            This platform is invite-only. Contact your agency administrator
            for an invitation, or request access below.
          </p>

          <div className="space-y-3">
            <Link
              href="/request-access"
              className="block w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              Request Access
            </Link>

            <SignOutButton>
              <button className="block w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg transition-colors text-sm">
                Sign Out
              </button>
            </SignOutButton>
          </div>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          If you believe this is an error, contact{' '}
          <a href="mailto:support@credentis.com" className="text-primary-600 hover:underline">
            support@credentis.com
          </a>
        </p>
      </div>
    </div>
  );
}
