import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const ATTEST_REASON_CODES = [
  'all_requirements_verified',
  'manager_review_completed',
  'conditional_clearance',
  'other',
] as const;

export class AttestAssignmentDto {
  @IsString()
  @IsIn(ATTEST_REASON_CODES)
  reasonCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonText?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24 * 30)
  expiresInHours?: number;
}

