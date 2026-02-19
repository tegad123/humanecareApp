import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { StorageModule } from './storage/storage.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { CliniciansModule } from './modules/clinicians/clinicians.module.js';
import { ChecklistTemplatesModule } from './modules/checklist-templates/checklist-templates.module.js';
import { ChecklistItemsModule } from './modules/checklist-items/checklist-items.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { TemplateCustomizationModule } from './modules/template-customization/template-customization.module.js';
import { TemplateDocumentsModule } from './modules/template-documents/template-documents.module.js';
import { EmailSettingsModule } from './modules/email-settings/email-settings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    StorageModule,
    OrganizationsModule,
    UsersModule,
    CliniciansModule,
    ChecklistTemplatesModule,
    ChecklistItemsModule,
    AuditLogsModule,
    JobsModule,
    TemplateCustomizationModule,
    TemplateDocumentsModule,
    EmailSettingsModule,
  ],
})
export class AppModule {}
