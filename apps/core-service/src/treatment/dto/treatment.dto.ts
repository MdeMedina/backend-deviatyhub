import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTreatmentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  duration_avg_min?: number;

  @IsUUID('4')
  @IsOptional()
  encyclopedia_ref?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  doctor_ids?: string[];
}

export class UpdateTreatmentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  duration_avg_min?: number;

  @IsUUID('4')
  @IsOptional()
  encyclopedia_ref?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  doctor_ids?: string[];

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class CreateOfferDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsOptional()
  @Type(() => Date)
  valid_until?: Date;
}
