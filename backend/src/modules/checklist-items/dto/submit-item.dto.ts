import { IsString, IsOptional, IsDateString, IsBoolean, MaxLength, IsIn } from 'class-validator';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export class SubmitItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  valueText?: string;

  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  valueSelect?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  docStoragePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  docOriginalName?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_MIME_TYPES, { message: 'File type not allowed. Accepted: PDF, JPEG, PNG, DOC, DOCX.' })
  docMimeType?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  // E-signature fields
  @IsOptional()
  @IsString()
  @MaxLength(200)
  signerName?: string;

  @IsOptional()
  @IsBoolean()
  agreement?: boolean;
}
