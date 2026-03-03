'use client';

import Link from 'next/link';
import { CredentisLogo } from '@/components/logo';
import { privacyPolicyHtml } from './privacy-content';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <CredentisLogo className="w-8 h-8" />
            <span className="font-bold text-lg text-slate-900">Credentis</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            &larr; Back to home
          </Link>
        </div>
      </header>

      {/* Privacy Policy Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div
          className="privacy-policy-content"
          dangerouslySetInnerHTML={{ __html: privacyPolicyHtml }}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-xs text-slate-500">
          &copy; 2026 Credentis. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
