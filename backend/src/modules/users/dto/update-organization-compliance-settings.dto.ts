import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateOrganizationComplianceSettingsDto {
  @IsOptional()
  @IsBoolean()
  requireDualApprovalForHighRiskOverride?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^([A-Za-z0-9_+\-]+(?:\/[A-Za-z0-9_+\-]+){1,2}|UTC)$/)
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3650)
  retentionDays?: number;
}
