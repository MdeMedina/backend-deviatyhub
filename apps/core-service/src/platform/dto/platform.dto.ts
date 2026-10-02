import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
