import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    // Determine role and redirect accordingly
    try {
      const user = await apiFetch<{ role: string }>('/users/me');
      if (user.role === 'clinician') {
        redirect('/checklist');
      }
    } catch {
      // If /me fails (user not yet linked), default to dashboard
    }
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <main className="flex flex-col items-center gap-6 text-center px-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100">
          <ShieldCheck className="w-8 h-8 text-primary-600" />
        </div>
        <h1 className="text-3xl font-semibold text-slate-900">
          HumaneCare
        </h1>
        <p className="text-slate-600 max-w-md">
          Clinician onboarding and compliance management for home health and
          staffing agencies.
        </p>
        <div className="flex gap-3 mt-4">
          <a
            href="/sign-in"
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium text-sm"
          >
            Sign In
          </a>
        </div>
      </main>
    </div>
  );
}
