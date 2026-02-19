import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateTemplateDocumentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

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
