import { IsString, IsOptional, IsEmail } from 'class-validator';

export class UpdateClinicianDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

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
