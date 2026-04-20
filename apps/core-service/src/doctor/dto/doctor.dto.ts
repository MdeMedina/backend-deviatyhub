import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsArray, IsUUID } from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'El título o cargo es obligatorio' })
  title!: string;

  @IsArray()
  @IsUUID('4', { each: true, message: 'Los IDs de tratamientos deben ser UUID v4 válidos' })
  @IsOptional()
  treatment_ids?: string[];
}

export class UpdateDoctorDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  treatment_ids?: string[];

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
