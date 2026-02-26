export interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export interface PageTour {
  route: string;
  steps: TourStep[];
  nextPageRoute?: string;
  nextPageLabel?: string;
}

export const pageTours: PageTour[] = [
  // ─── Dashboard Overview ───
  {
    route: '/dashboard',
    nextPageRoute: '/dashboard/clinicians',
    nextPageLabel: 'Clinicians',
    steps: [
      {
        target: 'nav-overview',
        title: 'Welcome to Credentis!',
        content:
          'This is your command center. The Dashboard gives you a bird\'s-eye view of all clinician onboarding and compliance activity.',
        placement: 'right',
      },
      {
        target: 'kpi-cards',
        title: 'Key Metrics',
        content:
          'These cards show your total clinicians, how many are ready to staff, currently onboarding, and not ready. Monitor these to track compliance at a glance.',
        placement: 'bottom',
      },
      {
        target: 'upcoming-expirations',
        title: 'Upcoming Expirations',
        content:
          'Credentials expiring within 30 days appear here. Click any row to jump directly to that clinician and take action.',
        placement: 'bottom',
      },
      {
        target: 'recent-clinicians',
        title: 'Recent Clinicians',
        content:
          'Your most recently added clinicians with their status and progress. Click "View all" to see the full roster.',
        placement: 'bottom',
      },
      {
        target: 'nav-clinicians',
        title: 'Next: Manage Clinicians',
        content:
          'Let\'s head to the Clinicians page to see how you manage your roster.',
        placement: 'right',
      },
    ],
  },

  // ─── Clinicians ───
  {
    route: '/dashboard/clinicians',
    nextPageRoute: '/dashboard/templates',
    nextPageLabel: 'Templates',
    steps: [
      {
        target: 'add-clinician-btn',
        title: 'Add a Clinician',
        content:
          'Click here to add a new clinician. Enter their details, pick a discipline, and assign a checklist template. An invite email is sent automatically.',
        placement: 'bottom',
      },
      {
        target: 'clinician-search',
        title: 'Search & Filter',
        content:
          'Search by name or email, and use the dropdown filters to narrow by status or discipline.',
        placement: 'bottom',
      },
      {
        target: 'clinician-table',
        title: 'Clinician Roster',
        content:
          'Each row shows a clinician\'s status, progress, and assigned recruiter. Click any name to see their full detail page with documents and checklist.',
        placement: 'top',
      },
      {
        target: 'nav-templates',
        title: 'Next: Templates',
        content:
          'Templates define what documents and credentials each clinician needs. Let\'s take a look.',
        placement: 'right',
      },
    ],
  },

  // ─── Templates ───
  {
    route: '/dashboard/templates',
    nextPageRoute: '/dashboard/email-settings',
    nextPageLabel: 'Email Settings',
    steps: [
      {
        target: 'templates-header',
        title: 'Checklist Templates',
        content:
          'Templates define the compliance checklist assigned to clinicians. Each discipline (PT, RN, etc.) can have its own template with different required documents.',
        placement: 'bottom',
      },
      {
        target: 'global-templates',
        title: 'Global vs Custom',
        content:
          'Global templates are pre-built starting points. Click "Customize" to clone one and create your own version with custom items.',
        placement: 'bottom',
      },
      {
        target: 'nav-email-settings',
        title: 'Next: Email Settings',
        content:
          'Customize the invite email your clinicians receive when they\'re onboarded.',
        placement: 'right',
      },
    ],
  },

  // ─── Email Settings ───
  {
    route: '/dashboard/email-settings',
    nextPageRoute: '/dashboard/audit-logs',
    nextPageLabel: 'Audit Logs',
    steps: [
      {
        target: 'email-form',
        title: 'Customize Invite Emails',
        content:
          'Edit the subject line, intro text, and signature that clinicians see in their onboarding invitation. Use {{orgName}} to auto-insert your agency name.',
        placement: 'bottom',
      },
      {
        target: 'email-preview',
        title: 'Live Preview',
        content:
          'See exactly how the email will look to your clinicians before saving changes.',
        placement: 'left',
      },
      {
        target: 'nav-audit-logs',
        title: 'Next: Audit Logs',
        content:
          'Track every action taken across your organization.',
        placement: 'right',
      },
    ],
  },

  // ─── Audit Logs ───
  {
    route: '/dashboard/audit-logs',
    nextPageRoute: '/dashboard/settings',
    nextPageLabel: 'Settings',
    steps: [
      {
        target: 'audit-log-list',
        title: 'Audit Trail',
        content:
          'Every action in your organization is logged here — clinician additions, document reviews, role changes, and more. Each entry shows who did what and when.',
        placement: 'bottom',
      },
      {
        target: 'nav-settings',
        title: 'Next: Team Settings',
        content:
          'Manage your team members and their roles.',
        placement: 'right',
      },
    ],
  },

  // ─── Settings ───
  {
    route: '/dashboard/settings',
    nextPageRoute: '/dashboard/billing',
    nextPageLabel: 'Billing',
    steps: [
      {
        target: 'team-members-card',
        title: 'Team Members',
        content:
          'View everyone on your team — their role, when they joined, and whether their invite is still pending.',
        placement: 'bottom',
      },
      {
        target: 'invite-member-btn',
        title: 'Invite Team Members',
        content:
          'Invite colleagues by email and assign them a role. Roles control access — from full admin to focused roles like Recruiter or Compliance.',
        placement: 'left',
      },
      {
        target: 'nav-billing',
        title: 'Next: Billing',
        content:
          'Manage your subscription and payment details.',
        placement: 'right',
      },
    ],
  },

  // ─── Billing ───
  {
    route: '/dashboard/billing',
    steps: [
      {
        target: 'plan-comparison',
        title: 'Your Subscription',
        content:
          'Compare plans here. The free tier supports up to 3 clinicians, while the paid plan unlocks unlimited clinicians and priority support.',
        placement: 'bottom',
      },
      {
        target: 'restart-tour',
        title: 'Tour Complete! 🎉',
        content:
          'You\'ve seen all the major features of Credentis. You can replay this tour anytime by clicking this button. Welcome aboard!',
        placement: 'right',
      },
    ],
  },
];
