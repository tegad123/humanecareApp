import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const REVOKE_REASON_CODES = [
  'credential_change',
  'manual_reassessment',
  'incident_review',
  'other',
] as const;

export class RevokeAssignmentAttestationDto {
  @IsString()
  @IsIn(REVOKE_REASON_CODES)
  reasonCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonText?: string;
}

