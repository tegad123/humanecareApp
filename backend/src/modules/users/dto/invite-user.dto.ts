import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  role!: 'admin' | 'recruiter' | 'compliance' | 'scheduler' | 'payroll';

  @IsString()
  @IsNotEmpty()
  organizationId!: string;
}
