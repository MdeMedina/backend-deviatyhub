import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** "09:00", "18:30". Se guarda como texto igual que el horario de la clínica. */
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class ScheduleBlockDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week!: number;

  @Matches(HORA, { message: 'start_time debe tener formato HH:MM' })
  start_time!: string;

  @Matches(HORA, { message: 'end_time debe tener formato HH:MM' })
  end_time!: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

/**
 * La jornada semanal se envía completa y reemplaza a la anterior. Un editor
 * semanal se maneja así de forma natural, y evita el baile de altas y bajas
 * parciales que haría falta para llegar al mismo sitio.
 */
export class PutScheduleDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ScheduleBlockDto)
  blocks!: ScheduleBlockDto[];
}

export class CreateAbsenceDto {
  @IsDateString()
  starts_at!: string;

  @IsDateString()
  ends_at!: string;

  @IsBoolean()
  @IsOptional()
  all_day?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  reason?: string;
}
