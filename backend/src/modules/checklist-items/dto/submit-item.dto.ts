import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class SubmitItemDto {
  @IsOptional()
  @IsString()
  valueText?: string;

  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @IsOptional()
  @IsString()
  valueSelect?: string;

  @IsOptional()
  @IsString()
  docStoragePath?: string;

  @IsOptional()
  @IsString()
  docOriginalName?: string;

  @IsOptional()
  @IsString()
  docMimeType?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  // E-signature fields
  @IsOptional()
  @IsString()
  signerName?: string;

  @IsOptional()
  @IsBoolean()
  agreement?: boolean;
}
