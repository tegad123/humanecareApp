import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class ReviewItemDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  rejectionComment?: string;
}
