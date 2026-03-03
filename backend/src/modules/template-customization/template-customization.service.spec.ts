import { BadRequestException } from '@nestjs/common';
import { TemplateCustomizationService } from './template-customization.service.js';

describe('TemplateCustomizationService publishTemplate', () => {
  const user = {
    id: 'user_1',
    organizationId: 'org_1',
    role: 'admin',
    email: 'admin@agency.com',
    clerkUserId: 'clerk_user_1',
    entityType: 'user',
  } as any;

  const publishDto = {
    reviewedLicense: true,
    reviewedBackgroundCheck: true,
    reviewedExclusionCheck: true,
    reviewedLiabilityInsurance: true,
    reviewedOrientation: true,
    reviewedStateSpecificItems: true,
    attestationAccepted: true,
    jurisdictionState: 'TX',
  };

  it('fails when publish checklist is incomplete', async () => {
    const service = new TemplateCustomizationService(
      {
        checklistTemplate: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'template_1',
            organizationId: 'org_1',
            isCustomized: true,
            discipline: 'RN',
            itemDefinitions: [{ id: 'item_1', label: 'RN License' }],
          }),
        },
      } as any,
      { log: jest.fn() } as any,
    );

    await expect(
      service.publishTemplate(
        'template_1',
        {
          ...publishDto,
          reviewedLicense: false,
        },
        user,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('fails when attestation checkbox is not accepted', async () => {
    const service = new TemplateCustomizationService(
      {
        checklistTemplate: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'template_1',
            organizationId: 'org_1',
            isCustomized: true,
            discipline: 'RN',
            itemDefinitions: [{ id: 'item_1', label: 'RN License' }],
          }),
        },
      } as any,
      { log: jest.fn() } as any,
    );

    await expect(
      service.publishTemplate(
        'template_1',
        {
          ...publishDto,
          attestationAccepted: false,
        } as any,
        user,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates publish attestation and increments revision when checklist is complete', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    const prisma = {
      checklistTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'template_1',
          organizationId: 'org_1',
          isCustomized: true,
          discipline: 'RN',
          itemDefinitions: [{ id: 'item_1', label: 'RN License' }],
        }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ published_revision: 2 }]),
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    const auditLogs = { log: jest.fn() };
    const service = new TemplateCustomizationService(prisma as any, auditLogs as any);

    const result = await service.publishTemplate('template_1', publishDto as any, user);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'template_published',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        templateId: 'template_1',
        publishedRevision: 3,
        attestationAccepted: true,
      }),
    );
  });
});
