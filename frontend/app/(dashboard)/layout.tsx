import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Sidebar } from '@/components/dashboard/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 pl-8 lg:pl-0">
            <Link href="/dashboard" className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary-600" />
              <span className="font-semibold text-slate-900">HumaneCare</span>
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
