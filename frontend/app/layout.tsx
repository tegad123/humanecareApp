import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'HumaneCare',
    template: '%s | HumaneCare',
  },
  description:
    'Clinician onboarding and compliance management for home health and staffing agencies.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.variable} font-[family-name:var(--font-inter)] antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
