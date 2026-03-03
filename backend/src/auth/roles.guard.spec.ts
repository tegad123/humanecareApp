import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

function createContext(user: any) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('RolesGuard', () => {
  it('allows super_admin for any guarded endpoint', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    const allowed = guard.canActivate(
      createContext({ role: 'super_admin' }),
    );
    expect(allowed).toBe(true);
  });

  it('blocks users without required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(createContext({ role: 'recruiter' })),
    ).toThrow(ForbiddenException);
  });

  it('allows users with required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin', 'recruiter']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    const allowed = guard.canActivate(
      createContext({ role: 'recruiter' }),
    );
    expect(allowed).toBe(true);
  });
});

