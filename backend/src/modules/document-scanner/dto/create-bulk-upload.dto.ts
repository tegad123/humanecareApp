import {
  IsArray,
  ValidateNested,
  IsString,
  IsIn,
  MaxLength,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class BulkUploadFileDto {
  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsString()
  @IsIn([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ])
  contentType: string;
}

export class CreateBulkUploadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BulkUploadFileDto)
  files: BulkUploadFileDto[];
}
