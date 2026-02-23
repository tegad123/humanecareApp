import type { Metadata } from 'next';
import { Inter, DM_Sans, Bricolage_Grotesque } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Credentis',
    template: '%s | Credentis',
  },
  description:
    'Credential compliance for home health agencies. Automate clinician onboarding, track expirations, and know who is ready to staff.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.variable} ${dmSans.variable} ${bricolage.variable} font-[family-name:var(--font-inter)] antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
