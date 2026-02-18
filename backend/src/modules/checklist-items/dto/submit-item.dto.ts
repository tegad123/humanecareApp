import { IsString, IsOptional, IsDateString } from 'class-validator';

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
}
