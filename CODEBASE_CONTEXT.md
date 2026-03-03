# Codebase Context (Commit `aa88e84`)

This file is a working memory map of the repo so future tasks can target the right files quickly.

## Repo Layout

- `backend/`: NestJS API + Prisma + cron jobs.
- `frontend/`: Next.js app (App Router) + Clerk auth + admin + clinician portals.
- `scripts/`: local DB/test scripts for static and race-condition checks.
- Root workspace scripts run frontend/backend together.

## Backend Overview

### Core

- `backend/src/main.ts`: global `/api` prefix, CORS allowlist from `FRONTEND_URL`, global validation pipe.
- `backend/src/app.module.ts`: wires all modules + global throttler defaults.
- `backend/src/auth/*`: Clerk token verification, role checks, public route metadata, admin/clinician conflict resolution.
- `backend/src/prisma/*`: Prisma client using `@prisma/adapter-pg`.

### Data Model (`backend/prisma/schema.prisma`)

- Key entities: `Organization`, `User`, `Clinician`, `ChecklistTemplate`, `ChecklistItemDefinition`, `ClinicianChecklistItem`, `TemplateDocument`, `OrgEmailSettings`, `AuditLog`, `InternalNote`, `AccessRequest`.
- Enums for role, discipline, item types/status, clinician status, plan tier.

### Business Modules

- `modules/access-requests/*`
  - Public request submission + tokenized approve/reject links.
  - Approval path creates org + admin user in transaction.
  - Admin notifications use `ADMIN_NOTIFICATION_EMAIL` plus super admins.
  - Per-endpoint throttle decorators added.
- `modules/billing/*`
  - Stripe subscription/portal/invoices/payment methods.
  - Webhook updates org billing fields/plan.
  - In-memory processed-event dedupe set.
- `modules/clinicians/*`
  - Clinician CRUD, invite token flow, profile/progress/stats/files/notes.
  - `ready-to-staff.service.ts` computes status and handles temporary overrides.
  - Invite validate/accept endpoints are public and throttled.
- `modules/checklist-items/*`
  - Submission by type (file/text/date/select/e-sign/admin_status).
  - E-signature supports typed signer + canvas signature + receipt artifact.
  - Admin review approve/reject flow.
- `modules/checklist-templates/*`: list/fetch global + org templates.
- `modules/template-customization/*`: clone template, CRUD/reorder item definitions, link docs.
- `modules/template-documents/*`: template-scoped doc upload/list/download/delete.
- `modules/org-documents/*`: org-wide document library + linkable docs.
- `modules/email-settings/*`: customizable invite email template text.
- `modules/users/*`: invite staff users, role updates, member removal.
- `modules/audit-logs/*`: org-scoped audit trail query + write helper.

### Background Jobs (`backend/src/jobs/*`)

- `expiration-job.service.ts`: expire passed checklist items + clear expired overrides.
- `reminder-job.service.ts`: reminder thresholds (30/14/7/1/0 days) + admin alerts.
- `email.service.ts`: Resend integration, fallback console logging in dev.

### Storage

- `storage/*`: presigned upload/download URL endpoints and S3 service.

## Frontend Overview

### App Structure

- Public pages:
  - `/` landing (`components/landing/landing-page.tsx`)
  - `/request-access`, `/sign-in`, `/sign-up`, `/no-access`
  - clinician invite acceptance flow under `/clinician/invite/[token]` + onboarding-link bridge.
- Admin area:
  - `app/(dashboard)/...` guarded server layout; blocks clinicians.
  - Includes Tawk widget script at dashboard layout level.
- Clinician area:
  - `app/(clinician)/...` guarded server layout; blocks admin/staff.
  - Includes Tawk widget script at clinician layout level.

### Main Admin Pages

- `dashboard/page.tsx`: KPIs, setup guide, upcoming expirations, recent clinicians.
- `dashboard/clinicians/*`: list/add/detail, review workflow, overrides, notes, download-all zip.
- `dashboard/templates/*`: template list, editor, template docs, upload/link docs.
- `dashboard/documents/page.tsx`: org document library CRUD.
- `dashboard/email-settings/page.tsx`: invite email editing + preview.
- `dashboard/audit-logs/page.tsx`: filter/search/export audit logs.
- `dashboard/billing/page.tsx`: Stripe plan management/invoices/payment methods.
- `dashboard/settings/page.tsx`: team member invites/role changes/removal.

### Main Clinician Pages

- `checklist/page.tsx`: grouped items + progress/filters.
- `checklist/[itemId]/page.tsx`: type-specific submit UI, linked document viewing, e-sign capture.
- `profile/page.tsx`: clinician profile.

### Shared Frontend Layers

- `components/ui/*`: base UI primitives.
- `components/dashboard/*`: KPI cards, review modal, override panel, notes, sidebar.
- `components/tour/*` + `lib/tour-steps.ts`: multi-page guided tour logic.
- `lib/api-client.ts`: browser fetch helper.
- `lib/api.ts`: server fetch helper.
- `lib/api/*.ts`: domain-specific API wrappers.

## Scripts

- `scripts/setup-local-test-db.sh`: starts local Postgres 16, recreates test DB, applies migrations.
- `scripts/test-access-request-race.sh`: DB-level race test for access-request approval token consumption.
- `scripts/test-fixes-static.sh`: static grep-based regression checks for the high-priority fixes.

## Current Working Baseline

- Checked out to `main` at commit `aa88e84`.
- Focus of this snapshot: chat widget moved from root layout into dashboard and clinician layouts.
