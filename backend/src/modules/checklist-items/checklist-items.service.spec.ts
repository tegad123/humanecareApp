import { ForbiddenException } from '@nestjs/common';
import { ChecklistItemsService } from './checklist-items.service.js';

describe('ChecklistItemsService authorization', () => {
  it('blocks clinician from submitting another clinician item', async () => {
    const prisma = {
      clinicianChecklistItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'item_1',
          organizationId: 'org_1',
          clinicianId: 'clinician_2',
          status: 'not_started',
          itemDefinition: {
            adminOnly: false,
            type: 'text',
            label: 'Coverage Area',
            linkedDocumentId: null,
          },
        }),
      },
    } as any;

    const service = new ChecklistItemsService(
      prisma,
      { log: jest.fn() } as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.submit(
        'item_1',
        { valueText: 'Dallas' },
        {
          id: 'clinician_1',
          organizationId: 'org_1',
          role: 'clinician',
          email: 'c1@example.com',
          clerkUserId: 'clerk_1',
          entityType: 'clinician',
          clinicianId: 'clinician_1',
        } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

