import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import LandingPage from '@/components/landing/landing-page';

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    // Determine role and redirect accordingly
    try {
      const user = await apiFetch<{ role: string; entityType?: string }>('/users/me');
      if (user.role === 'clinician' || user.entityType === 'clinician') {
        redirect('/checklist');
      }
      redirect('/dashboard');
    } catch (e: any) {
      // Re-throw Next.js redirect
      if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e;
      // If /me fails, user is not linked to any org → send to no-access page
      redirect('/no-access');
    }
  }

  return <LandingPage />;
}
