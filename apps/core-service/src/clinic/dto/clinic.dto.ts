import {
  IsString,
  IsEmail,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateClinicConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  language?: string;
}

export class ClinicScheduleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week!: number;

  @IsString()
  open_time!: string;

  @IsString()
  close_time!: string;

  @IsOptional()
  @IsBoolean()
  is_open?: boolean;
}

export class UpdateSchedulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClinicScheduleDto)
  schedules!: ClinicScheduleDto[];
}

export class CreateUnavailabilityDto {
  @IsString()
  name!: string;

  @IsArray()
  @IsInt({ each: true })
  days_of_week!: number[];

  @IsString()
  start_time!: string;

  @IsString()
  end_time!: string;
}

export class UpdateUnavailabilityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  days_of_week?: number[];

  @IsOptional()
  @IsString()
  start_time?: string;

  @IsOptional()
  @IsString()
  end_time?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreatePolicyDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;
}

export class UpdatePolicyDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
