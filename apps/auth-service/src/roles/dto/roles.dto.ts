import { IsString, IsBoolean, IsObject, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  @IsOptional()
  isSuperadmin?: boolean = false;

  @IsObject()
  @IsNotEmpty()
  permissions!: Record<string, any>;
}

export class UpdatePermissionsDto {
  @IsObject()
  @IsNotEmpty()
  permissions!: Record<string, any>;
}
