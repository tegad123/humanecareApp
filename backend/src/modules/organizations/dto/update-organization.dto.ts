import { IsString, IsOptional } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  planTier?: 'starter' | 'growth' | 'pro';
}
