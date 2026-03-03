import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLegalHoldDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  caseReference?: string;
}

