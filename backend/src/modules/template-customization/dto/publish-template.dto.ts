import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class PublishTemplateDto {
  @IsBoolean()
  reviewedLicense!: boolean;

  @IsBoolean()
  reviewedBackgroundCheck!: boolean;

  @IsBoolean()
  reviewedExclusionCheck!: boolean;

  @IsBoolean()
  reviewedLiabilityInsurance!: boolean;

  @IsBoolean()
  reviewedOrientation!: boolean;

  @IsBoolean()
  reviewedStateSpecificItems!: boolean;

  @IsBoolean()
  attestationAccepted!: boolean;

  @IsOptional()
  @IsString()
  jurisdictionState?: string;
}

