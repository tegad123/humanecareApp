import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  planTier?: 'starter' | 'growth' | 'pro';
}
