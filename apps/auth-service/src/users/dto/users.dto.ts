import { IsEmail, IsNotEmpty, IsUUID, IsOptional, IsBoolean, IsString } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  /**
   * Opcional cuando se invita a un profesional: si no viene, se usa (creándolo
   * si hace falta) el rol Doctor, que es el único que tiene sentido para él.
   */
  @IsUUID()
  @IsOptional()
  roleId?: string;

  /** Ficha de profesional a la que queda enlazada esta cuenta. */
  @IsUUID()
  @IsOptional()
  doctorId?: string;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  email?: string;

  @IsUUID()
  @IsOptional()
  roleId?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsOptional()
  password?: string;
}

export class SetPasswordDto {
  @IsNotEmpty()
  token!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;

  @IsNotEmpty()
  @IsString()
  password_confirm!: string;
}
