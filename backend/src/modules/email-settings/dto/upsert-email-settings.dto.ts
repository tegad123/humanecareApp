import { IsString, IsOptional } from 'class-validator';

export class UpsertEmailSettingsDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  introText?: string;

  @IsOptional()
  @IsString()
  requiredItemsIntro?: string;

  @IsOptional()
  @IsString()
  signatureBlock?: string;

  @IsOptional()
  @IsString()
  legalDisclaimer?: string;
}
