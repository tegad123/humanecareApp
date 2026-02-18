import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional } from 'class-validator';

export class SetOverrideDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsNumber()
  @Min(1)
  @Max(72)
  expiresInHours!: number;

  @IsOptional()
  @IsString()
  overrideValue?: string; // defaults to 'ready'
}
