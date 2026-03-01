import { IsString, IsNotEmpty, IsEmail, IsOptional, IsInt, Min, Matches, MaxLength, IsIn } from 'class-validator';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
];

export class CreateAccessRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  agencyName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  requesterName!: string;

  @IsEmail()
  @IsNotEmpty()
  workEmail!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s\-().]+$/, { message: 'Phone number format is invalid' })
  phone?: string;

  @IsOptional()
  @IsString()
  @IsIn(US_STATES, { message: 'Invalid US state abbreviation' })
  state?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedClinicianCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emr?: string;
}
