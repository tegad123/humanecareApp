import { IsString, IsNotEmpty, IsOptional, IsInt, IsIn } from 'class-validator';

export const DOCUMENT_CATEGORIES = ['contract', 'form', 'policy', 'agreement', 'other'] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export class CreateOrgDocumentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(DOCUMENT_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsOptional()
  @IsInt()
  fileSizeBytes?: number;
}
