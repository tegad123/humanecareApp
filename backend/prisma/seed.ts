import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Discipline, ChecklistItemType } from '../generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Shared item definitions by section ─────────────────

interface ItemDef {
  label: string;
  section: string;
  type: ChecklistItemType;
  required: boolean;
  blocking: boolean;
  adminOnly: boolean;
  hasExpiration: boolean;
  sortOrder: number;
  configJson?: any;
}

const SECTIONS = {
  IDENTITY: 'Identity & Contact',
  LICENSURE: 'Licensure',
  CLINICAL: 'Clinical Requirements',
  HR_PAY: 'HR & Pay',
  AGREEMENTS: 'Agreements',
};

// Base items shared across most templates
function baseIdentityItems(startOrder: number): ItemDef[] {
  return [
    {
      label: "Driver's License or State ID",
      section: SECTIONS.IDENTITY,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: startOrder,
    },
    {
      label: 'Social Security Card',
      section: SECTIONS.IDENTITY,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: false,
      sortOrder: startOrder + 1,
    },
    {
      label: 'Professional Headshot Photo',
      section: SECTIONS.IDENTITY,
      type: 'file_upload',
      required: false,
      blocking: false,
      adminOnly: false,
      hasExpiration: false,
      sortOrder: startOrder + 2,
    },
  ];
}

function baseClinicalItems(startOrder: number): ItemDef[] {
  return [
    {
      label: 'CPR/BLS Certification',
      section: SECTIONS.CLINICAL,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: startOrder,
    },
    {
      label: 'TB Test / PPD Results',
      section: SECTIONS.CLINICAL,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: startOrder + 1,
    },
    {
      label: 'Physical Exam / Health Clearance',
      section: SECTIONS.CLINICAL,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: startOrder + 2,
    },
    {
      label: 'COVID-19 Vaccination Record',
      section: SECTIONS.CLINICAL,
      type: 'file_upload',
      required: false,
      blocking: false,
      adminOnly: false,
      hasExpiration: false,
      sortOrder: startOrder + 3,
    },
    {
      label: 'Hepatitis B Vaccination / Declination',
      section: SECTIONS.CLINICAL,
      type: 'file_upload',
      required: true,
      blocking: false,
      adminOnly: false,
      hasExpiration: false,
      sortOrder: startOrder + 4,
    },
  ];
}

function baseHrPayItems(startOrder: number): ItemDef[] {
  return [
    {
      label: 'W-9 Form',
      section: SECTIONS.HR_PAY,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: false,
      sortOrder: startOrder,
    },
    {
      label: 'Direct Deposit Authorization',
      section: SECTIONS.HR_PAY,
      type: 'file_upload',
      required: true,
      blocking: false,
      adminOnly: false,
      hasExpiration: false,
      sortOrder: startOrder + 1,
    },
    {
      label: 'Auto Insurance (if driving to visits)',
      section: SECTIONS.HR_PAY,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: startOrder + 2,
    },
    {
      label: 'Professional Liability Insurance',
      section: SECTIONS.HR_PAY,
      type: 'file_upload',
      required: false,
      blocking: false,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: startOrder + 3,
    },
  ];
}

function baseAgreementItems(startOrder: number): ItemDef[] {
  return [
    {
      label: 'Independent Contractor Agreement',
      section: SECTIONS.AGREEMENTS,
      type: 'e_signature',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: false,
      sortOrder: startOrder,
      configJson: {
        agreementText:
          'I acknowledge that I am an independent contractor and not an employee. I understand and agree to the terms of the Independent Contractor Agreement.',
      },
    },
    {
      label: 'HIPAA Acknowledgment',
      section: SECTIONS.AGREEMENTS,
      type: 'e_signature',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: false,
      sortOrder: startOrder + 1,
      configJson: {
        agreementText:
          'I acknowledge that I have received and reviewed the HIPAA Privacy and Security policies. I agree to comply with all HIPAA regulations in the course of my work.',
      },
    },
    {
      label: 'Background Check Consent',
      section: SECTIONS.AGREEMENTS,
      type: 'e_signature',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: false,
      sortOrder: startOrder + 2,
      configJson: {
        agreementText:
          'I authorize the agency to conduct a background check as a condition of engagement. I understand that results may affect my eligibility for assignments.',
      },
    },
    {
      label: 'Background Check Status',
      section: SECTIONS.AGREEMENTS,
      type: 'admin_status',
      required: true,
      blocking: true,
      adminOnly: true,
      hasExpiration: false,
      sortOrder: startOrder + 3,
      configJson: {
        options: ['clear', 'pending', 'flagged'],
      },
    },
  ];
}

function coverageItem(sortOrder: number): ItemDef {
  return {
    label: 'Coverage Area / Counties',
    section: SECTIONS.IDENTITY,
    type: 'text',
    required: true,
    blocking: false,
    adminOnly: false,
    hasExpiration: false,
    sortOrder,
  };
}

function npiItem(sortOrder: number): ItemDef {
  return {
    label: 'NPI Number',
    section: SECTIONS.IDENTITY,
    type: 'text',
    required: true,
    blocking: false,
    adminOnly: false,
    hasExpiration: false,
    sortOrder,
  };
}

// ─── Template definitions ───────────────────────────────

interface TemplateDef {
  name: string;
  slug: string;
  state: string;
  discipline: Discipline;
  description: string;
  items: ItemDef[];
}

function ptLicenseItems(): ItemDef[] {
  return [
    {
      label: 'TX Physical Therapy License',
      section: SECTIONS.LICENSURE,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: 10,
    },
  ];
}

function otLicenseItems(): ItemDef[] {
  return [
    {
      label: 'TX Occupational Therapy License',
      section: SECTIONS.LICENSURE,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: 10,
    },
  ];
}

function slpLicenseItems(): ItemDef[] {
  return [
    {
      label: 'TX Speech-Language Pathology License',
      section: SECTIONS.LICENSURE,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: 10,
    },
    {
      label: 'ASHA Certificate of Clinical Competence (CCC-SLP)',
      section: SECTIONS.LICENSURE,
      type: 'file_upload',
      required: false,
      blocking: false,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: 11,
    },
  ];
}

function mswLicenseItems(): ItemDef[] {
  return [
    {
      label: 'TX Licensed Master Social Worker (LMSW) License',
      section: SECTIONS.LICENSURE,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: 10,
    },
  ];
}

function ptaLicenseItems(): ItemDef[] {
  return [
    {
      label: 'TX Physical Therapist Assistant License',
      section: SECTIONS.LICENSURE,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: 10,
    },
  ];
}

function cotaLicenseItems(): ItemDef[] {
  return [
    {
      label: 'TX Certified Occupational Therapy Assistant License',
      section: SECTIONS.LICENSURE,
      type: 'file_upload',
      required: true,
      blocking: true,
      adminOnly: false,
      hasExpiration: true,
      sortOrder: 10,
    },
  ];
}

function oasisCompetency(): ItemDef {
  return {
    label: 'OASIS Competency Verification',
    section: SECTIONS.CLINICAL,
    type: 'file_upload',
    required: false,
    blocking: false,
    adminOnly: false,
    hasExpiration: false,
    sortOrder: 35,
  };
}

function buildTemplateItems(licenseItems: ItemDef[], includeOasis: boolean): ItemDef[] {
  const items: ItemDef[] = [
    ...baseIdentityItems(1),
    npiItem(4),
    coverageItem(5),
    ...licenseItems,
    ...baseClinicalItems(20),
    ...baseHrPayItems(40),
    ...baseAgreementItems(50),
  ];
  if (includeOasis) {
    items.push(oasisCompetency());
  }
  return items;
}

const templates: TemplateDef[] = [
  {
    name: 'TX Home Health - Physical Therapist (PT)',
    slug: 'tx_home_health_pt',
    state: 'TX',
    discipline: 'PT',
    description: 'Onboarding checklist for Physical Therapists in Texas home health settings.',
    items: buildTemplateItems(ptLicenseItems(), true),
  },
  {
    name: 'TX Home Health - Occupational Therapist (OT)',
    slug: 'tx_home_health_ot',
    state: 'TX',
    discipline: 'OT',
    description: 'Onboarding checklist for Occupational Therapists in Texas home health settings.',
    items: buildTemplateItems(otLicenseItems(), true),
  },
  {
    name: 'TX Home Health - Speech-Language Pathologist (SLP)',
    slug: 'tx_home_health_slp',
    state: 'TX',
    discipline: 'SLP',
    description: 'Onboarding checklist for Speech-Language Pathologists in Texas home health settings.',
    items: buildTemplateItems(slpLicenseItems(), true),
  },
  {
    name: 'TX Home Health - Medical Social Worker (MSW)',
    slug: 'tx_home_health_msw',
    state: 'TX',
    discipline: 'MSW',
    description: 'Onboarding checklist for Medical Social Workers in Texas home health settings.',
    items: buildTemplateItems(mswLicenseItems(), false),
  },
  {
    name: 'TX Home Health - Physical Therapist Assistant (PTA)',
    slug: 'tx_home_health_pta',
    state: 'TX',
    discipline: 'PTA',
    description: 'Onboarding checklist for Physical Therapist Assistants in Texas home health settings.',
    items: buildTemplateItems(ptaLicenseItems(), false),
  },
  {
    name: 'TX Home Health - Certified OT Assistant (COTA)',
    slug: 'tx_home_health_cota',
    state: 'TX',
    discipline: 'COTA',
    description: 'Onboarding checklist for Certified Occupational Therapy Assistants in Texas home health settings.',
    items: buildTemplateItems(cotaLicenseItems(), false),
  },
  {
    name: 'TX Pediatric Therapy - Contractor',
    slug: 'tx_peds_therapy_contractor',
    state: 'TX',
    discipline: 'OTHER',
    description: 'Onboarding checklist for pediatric therapy contractors in Texas (PT/OT/SLP).',
    items: [
      ...baseIdentityItems(1),
      npiItem(4),
      coverageItem(5),
      {
        label: 'TX Therapy License (PT, OT, or SLP)',
        section: SECTIONS.LICENSURE,
        type: 'file_upload',
        required: true,
        blocking: true,
        adminOnly: false,
        hasExpiration: true,
        sortOrder: 10,
      },
      {
        label: 'Pediatric Experience Attestation',
        section: SECTIONS.LICENSURE,
        type: 'file_upload',
        required: true,
        blocking: false,
        adminOnly: false,
        hasExpiration: false,
        sortOrder: 11,
      },
      ...baseClinicalItems(20),
      ...baseHrPayItems(40),
      ...baseAgreementItems(50),
    ],
  },
  {
    name: 'TX School-Based SLP - Contractor',
    slug: 'tx_school_slp_contractor',
    state: 'TX',
    discipline: 'SLP',
    description: 'Onboarding checklist for school-based SLP contractors in Texas.',
    items: [
      ...baseIdentityItems(1),
      npiItem(4),
      coverageItem(5),
      ...slpLicenseItems(),
      {
        label: 'TX Educator Certification (if applicable)',
        section: SECTIONS.LICENSURE,
        type: 'file_upload',
        required: false,
        blocking: false,
        adminOnly: false,
        hasExpiration: true,
        sortOrder: 12,
      },
      {
        label: 'School District Background Check Clearance',
        section: SECTIONS.LICENSURE,
        type: 'file_upload',
        required: true,
        blocking: true,
        adminOnly: false,
        hasExpiration: true,
        sortOrder: 13,
      },
      ...baseClinicalItems(20),
      ...baseHrPayItems(40),
      ...baseAgreementItems(50),
    ],
  },
];

async function main() {
  console.log('Seeding database...');

  // Create platform organization for super_admin
  const platformOrg = await prisma.organization.upsert({
    where: { id: 'platform-org-id' },
    update: {},
    create: {
      id: 'platform-org-id',
      name: 'HumaneCare Platform',
      planTier: 'pro',
      planFlags: { ai_doc_intelligence: false, sms_reminders: false },
    },
  });
  console.log(`Created platform org: ${platformOrg.name}`);

  // Create super_admin user (placeholder clerk_user_id — update after Clerk setup)
  const superAdmin = await prisma.user.upsert({
    where: { clerkUserId: 'clerk_super_admin_placeholder' },
    update: {},
    create: {
      organizationId: platformOrg.id,
      clerkUserId: 'clerk_super_admin_placeholder',
      email: 'admin@humanecare.app',
      name: 'Platform Admin',
      role: 'super_admin',
    },
  });
  console.log(`Created super admin: ${superAdmin.email}`);

  // Seed checklist templates
  for (const tmpl of templates) {
    const template = await prisma.checklistTemplate.upsert({
      where: { slug: tmpl.slug },
      update: {
        name: tmpl.name,
        state: tmpl.state,
        discipline: tmpl.discipline,
        description: tmpl.description,
      },
      create: {
        name: tmpl.name,
        slug: tmpl.slug,
        state: tmpl.state,
        discipline: tmpl.discipline,
        description: tmpl.description,
        organizationId: null, // global template
      },
    });

    // Delete existing definitions (for re-seeding)
    await prisma.checklistItemDefinition.deleteMany({
      where: { templateId: template.id },
    });

    // Create item definitions
    await prisma.checklistItemDefinition.createMany({
      data: tmpl.items.map((item) => ({
        templateId: template.id,
        label: item.label,
        section: item.section,
        type: item.type,
        required: item.required,
        blocking: item.blocking,
        adminOnly: item.adminOnly,
        hasExpiration: item.hasExpiration,
        sortOrder: item.sortOrder,
        configJson: item.configJson || null,
      })),
    });

    console.log(`Seeded template: ${tmpl.name} (${tmpl.items.length} items)`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
