import { IsString, IsNotEmpty, IsEmail, IsOptional, IsInt, Min } from 'class-validator';

export class CreateAccessRequestDto {
  @IsString()
  @IsNotEmpty()
  agencyName!: string;

  @IsString()
  @IsNotEmpty()
  requesterName!: string;

  @IsEmail()
  @IsNotEmpty()
  workEmail!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedClinicianCount?: number;

  @IsOptional()
  @IsString()
  emr?: string;
}
