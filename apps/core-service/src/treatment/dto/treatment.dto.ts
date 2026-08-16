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
  @IsOptional()
  category?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  duration_avg_min?: number;

  @IsString()
  @IsOptional()
  encyclopedia_ref?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  doctor_ids?: string[];

  // Campos adicionales del frontend
  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  price?: number;

  @IsOptional()
  duration_min?: number;

  @IsOptional()
  price_isapre?: number;

  @IsOptional()
  price_fonasa?: number;

  @IsOptional()
  @IsBoolean()
  accepts_isapre?: boolean;

  @IsOptional()
  @IsBoolean()
  accepts_fonasa?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  doctors?: any[];

  @IsOptional()
  @IsArray()
  offers?: any[];
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

  @IsString()
  @IsOptional()
  encyclopedia_ref?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  doctor_ids?: string[];

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  // Campos adicionales del frontend
  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  price?: number;

  @IsOptional()
  duration_min?: number;

  @IsOptional()
  price_isapre?: number;

  @IsOptional()
  price_fonasa?: number;

  @IsOptional()
  @IsBoolean()
  accepts_isapre?: boolean;

  @IsOptional()
  @IsBoolean()
  accepts_fonasa?: boolean;

  @IsOptional()
  @IsArray()
  doctors?: any[];

  @IsOptional()
  @IsArray()
  offers?: any[];
}

export class CreateOfferDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsOptional()
  discount_pct?: number;

  @IsOptional()
  fixed_price?: number;

  @IsOptional()
  @IsString()
  valid_from?: string;

  @IsOptional()
  @IsString()
  valid_until?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
