import { ReadyToStaffService } from './ready-to-staff.service.js';

describe('ReadyToStaffService Phase 1 readiness semantics', () => {
  it('marks assignment eligible when system is ready and attestation is active', async () => {
    const service = new ReadyToStaffService({} as any, { log: jest.fn() } as any);
    jest
      .spyOn(service, 'computeStatus')
      .mockResolvedValue('ready' as any);
    jest
      .spyOn(service, 'getLatestAssignmentAttestation')
      .mockResolvedValue({
        state: 'attested',
        reasonCode: 'all_requirements_verified',
        reasonText: null,
        attestedByUserId: 'user_1',
        attestedByRole: 'admin',
        attestedAt: new Date().toISOString(),
        expiresAt: null,
        revokedByUserId: null,
        revokedAt: null,
      });

    const result = await service.getReadiness('clinician_1', 'org_1');
    expect(result.systemStatus).toBe('ready');
    expect(result.assignmentAttestation?.state).toBe('attested');
    expect(result.assignmentEligible).toBe(true);
  });

  it('does not allow attestation unless clinician is system ready', async () => {
    const service = new ReadyToStaffService({} as any, { log: jest.fn() } as any);
    jest
      .spyOn(service, 'computeStatus')
      .mockResolvedValue('not_ready' as any);

    await expect(
      service.attestAssignment(
        'clinician_1',
        'org_1',
        'all_requirements_verified',
        null,
        null,
        'admin_1',
        'admin',
      ),
    ).rejects.toThrow('Cannot attest assignment unless clinician is System Ready.');
  });
});

