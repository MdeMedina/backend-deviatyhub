import { IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateClinicDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  /** Se deriva del nombre si no viene. */
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'El slug solo admite minúsculas, números y guiones.' })
  slug?: string;

  @IsOptional()
  @IsIn(['STARTER', 'PRO'])
  plan?: 'STARTER' | 'PRO';

  @IsEmail()
  billingEmail!: string;

  /** Primera persona con acceso: queda como dueña de la clínica. */
  @IsEmail()
  adminEmail!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateClinicDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(['STARTER', 'PRO'])
  plan?: 'STARTER' | 'PRO';

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;
}

/** Accesos de la clínica. Solo se aceptan las claves conocidas; el servicio descarta el resto. */
export class UpdateAccessDto {
  @IsOptional()
  @IsObject()
  modules?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  agent?: {
    enabled?: boolean;
    channels?: Record<string, boolean>;
    actions?: Record<string, boolean>;
    reminders?: boolean;
  };
}

export class InviteClinicUserDto {
  @IsEmail()
  email!: string;
}

export class WhatsAppOwnDto {
  @IsString()
  phone_number_id!: string;

  @IsOptional()
  @IsString()
  waba_id?: string;

  /** Vacío = se conserva el que había o, si no había, se usa el de Dentral. */
  @IsOptional()
  @IsString()
  access_token?: string;
}
