import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AppointmentStatusDto {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  RESCHEDULED = 'RESCHEDULED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum AppointmentSourceDto {
  AGENT = 'AGENT',
  HUMAN = 'HUMAN',
  EXTERNAL = 'EXTERNAL',
}

export class CreateAppointmentDto {
  @IsUUID('4')
  @IsOptional()
  contact_id?: string;

  // Si no hay contact_id, requerimos estos
  @IsString()
  @IsOptional()
  contact_name?: string;

  @IsString()
  @IsOptional()
  contact_phone?: string;

  @IsUUID('4')
  @IsNotEmpty()
  treatment_id!: string;

  @IsUUID('4')
  @IsNotEmpty()
  doctor_id!: string;

  @IsNotEmpty()
  @Type(() => Date)
  scheduled_at!: Date;

  @IsEnum(AppointmentSourceDto)
  @IsOptional()
  source?: AppointmentSourceDto;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID('4')
  @IsOptional()
  conversation_id?: string;
}

export class UpdateStatusDto {
  @IsEnum(AppointmentStatusDto)
  @IsNotEmpty()
  status!: AppointmentStatusDto;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RescheduleDto {
  @IsNotEmpty()
  @Type(() => Date)
  scheduled_at!: Date;

  @IsString()
  @IsOptional()
  notes?: string;
}
