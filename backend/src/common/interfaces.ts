import { Role } from '../../generated/prisma/client.js';

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: Role;
  email: string;
  clerkUserId: string;
  entityType: 'user' | 'clinician';
  clinicianId?: string;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
