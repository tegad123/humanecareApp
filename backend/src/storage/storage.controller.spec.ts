import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { StorageController } from './storage.controller.js';

describe('StorageController authorization', () => {
  const baseUser = {
    id: 'u_1',
    organizationId: 'org_1',
    role: 'clinician',
    email: 'clinician@agency.com',
    clerkUserId: 'clerk_1',
    entityType: 'clinician',
    clinicianId: 'clinician_1',
  };

  it('blocks download when key is outside org prefix', async () => {
    const controller = new StorageController(
      { getDownloadUrl: jest.fn() } as any,
      {
        clinicianChecklistItem: { findFirst: jest.fn() },
        templateDocument: { findFirst: jest.fn() },
      } as any,
    );

    await expect(
      controller.getDownloadUrl(baseUser, 'org_2/path/file.pdf'),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks clinician download for another clinician file in same org', async () => {
    const controller = new StorageController(
      { getDownloadUrl: jest.fn() } as any,
      {
        clinicianChecklistItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item_9',
            clinicianId: 'clinician_2',
          }),
        },
        templateDocument: { findFirst: jest.fn() },
      } as any,
    );

    await expect(
      controller.getDownloadUrl(baseUser, 'org_1/clinician_2/item_9/file.pdf'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows privileged role to download clinician file in same org', async () => {
    const getDownloadUrl = jest
      .fn()
      .mockResolvedValue({ url: 'https://example.com/file.pdf' });

    const controller = new StorageController(
      { getDownloadUrl } as any,
      {
        clinicianChecklistItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item_9',
            clinicianId: 'clinician_2',
          }),
        },
        templateDocument: { findFirst: jest.fn() },
      } as any,
    );

    const result = await controller.getDownloadUrl(
      {
        ...baseUser,
        role: 'admin',
        entityType: 'user',
        clinicianId: undefined,
      },
      'org_1/clinician_2/item_9/file.pdf',
    );

    expect(getDownloadUrl).toHaveBeenCalledWith(
      'org_1/clinician_2/item_9/file.pdf',
    );
    expect(result).toEqual({ url: 'https://example.com/file.pdf' });
  });
});

