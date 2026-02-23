import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { CredentisLogo } from '@/components/logo';
import { Sidebar } from '@/components/dashboard/sidebar';
import { apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Block clinicians from accessing the admin dashboard
  try {
    const me = await apiFetch<{ role: string; entityType?: string }>('/users/me');
    if (me.role === 'clinician' || me.entityType === 'clinician') {
      redirect('/checklist');
    }
  } catch (e: any) {
    // Re-throw Next.js redirect (it uses a special NEXT_REDIRECT error)
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e;
    // If /me fails, user is not linked to any org → redirect to no-access
    redirect('/no-access');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 pl-8 lg:pl-0">
            <Link href="/dashboard" className="flex items-center gap-2">
              <CredentisLogo className="h-5 w-5" />
              <span className="font-semibold text-slate-900">Credentis</span>
            </Link>
            <span className="hidden sm:inline-block text-xs text-slate-400 ml-2 border-l border-slate-200 pl-2">
              Admin
            </span>
          </div>
          <UserButton />
        </div>
      </header>

      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
