import { IsEmail, IsNotEmpty, IsUUID, IsOptional, IsBoolean, IsString } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsUUID()
  @IsNotEmpty()
  roleId!: string;
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
