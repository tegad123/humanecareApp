import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class CreateClinicianDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  discipline!: string;

  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @IsOptional()
  @IsString()
  assignedRecruiterId?: string;

  @IsOptional()
  @IsString()
  npi?: string;

  @IsOptional()
  @IsString()
  coverageArea?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
