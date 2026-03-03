import { IsIn, IsString, MaxLength } from 'class-validator';

export class AcceptPolicyDto {
  @IsIn(['terms', 'privacy', 'baa'])
  documentType!: 'terms' | 'privacy' | 'baa';

  @IsString()
  @MaxLength(50)
  documentVersion!: string;
}

