import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpdateUserRoleDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['super_admin', 'admin', 'recruiter', 'compliance', 'scheduler', 'payroll'])
  role!: 'super_admin' | 'admin' | 'recruiter' | 'compliance' | 'scheduler' | 'payroll';
}
