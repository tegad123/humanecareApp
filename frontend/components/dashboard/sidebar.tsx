'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  Mail,
  CreditCard,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { TourTriggerButton } from '@/components/tour/tour-trigger-button';

/**
 * Role-based access for sidebar navigation items.
 * Each nav item lists which roles can see it.
 * super_admin and admin see everything.
 */
const navItems = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin', 'recruiter', 'compliance', 'scheduler', 'payroll'],
  },
  {
    href: '/dashboard/clinicians',
    label: 'Clinicians',
    icon: Users,
    roles: ['super_admin', 'admin', 'recruiter', 'compliance', 'scheduler', 'payroll'],
  },
  {
    href: '/dashboard/templates',
    label: 'Templates',
    icon: ClipboardList,
    roles: ['super_admin', 'admin', 'compliance'],
  },
  {
    href: '/dashboard/email-settings',
    label: 'Email Settings',
    icon: Mail,
    roles: ['super_admin', 'admin'],
  },
  {
    href: '/dashboard/audit-logs',
    label: 'Audit Logs',
    icon: FileText,
    roles: ['super_admin', 'admin', 'compliance'],
  },
  {
    href: '/dashboard/billing',
    label: 'Billing',
    icon: CreditCard,
    roles: ['super_admin', 'admin'],
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['super_admin', 'admin'],
  },
];

export function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const visibleItems = useMemo(
    () => navItems.filter((item) => item.roles.includes(userRole)),
    [userRole],
  );

  const navContent = (
    <nav className="flex flex-col gap-1 px-3 py-4 h-full">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto pt-4 border-t border-slate-100">
        <TourTriggerButton />
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3.5 left-3 z-50 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 border-r border-slate-200 bg-white pt-14 transition-transform duration-200 lg:translate-x-0 lg:static lg:pt-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
