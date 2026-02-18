import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default async function ClinicianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link href="/checklist" className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary-600" />
            <span className="font-semibold text-slate-900">HumaneCare</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="text-sm text-slate-600 hover:text-slate-900 transition"
            >
              Profile
            </Link>
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
