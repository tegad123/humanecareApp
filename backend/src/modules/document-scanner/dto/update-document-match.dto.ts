import { IsOptional, IsString, IsIn, IsDateString } from 'class-validator';

export class UpdateDocumentMatchDto {
  @IsOptional()
  @IsString()
  matchedClinicianId?: string;

  @IsOptional()
  @IsString()
  matchedItemDefinitionId?: string;

  @IsOptional()
  @IsDateString()
  confirmedExpiration?: string;

  @IsOptional()
  @IsString()
  confirmedDocType?: string;

  @IsOptional()
  @IsIn(['matched', 'skipped'])
  status?: 'matched' | 'skipped';
}
