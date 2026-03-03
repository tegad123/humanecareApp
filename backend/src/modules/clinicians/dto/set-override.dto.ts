import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
} from 'class-validator';

const OVERRIDE_REASON_CODES = [
  'emergency_staffing',
  'temporary_transfer',
  'documentation_pending',
  'admin_exception',
  'other',
] as const;

export class SetOverrideDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(OVERRIDE_REASON_CODES)
  reasonCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonText?: string;

  @IsNumber()
  @Min(1)
  @Max(72)
  expiresInHours!: number;

  @IsOptional()
  @IsString()
  overrideValue?: string; // defaults to 'ready'

  @IsOptional()
  @IsUUID()
  secondApproverUserId?: string;
}
