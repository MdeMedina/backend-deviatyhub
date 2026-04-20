import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ConversationStatusDto {
  OPEN = 'OPEN',
  HUMAN_TAKEOVER = 'HUMAN_TAKEOVER',
  CLOSED = 'CLOSED',
}

export class ManualMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'El contenido del mensaje no puede estar vacío' })
  content!: string;
}

export class ConversationFilterDto {
  @IsEnum(ConversationStatusDto)
  @IsOptional()
  status?: ConversationStatusDto;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}
