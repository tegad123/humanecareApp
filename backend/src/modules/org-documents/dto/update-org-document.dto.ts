import { IsString, IsOptional, IsIn } from 'class-validator';
import { DOCUMENT_CATEGORIES } from './create-org-document.dto.js';

export class UpdateOrgDocumentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(DOCUMENT_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
