import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Inject,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { UsersService } from './users.service';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';
import { Auditable } from '../common/decorators/auditable.decorator';
import { cargarActor } from '../common/actor';

@Controller('auth/users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('UsersController initialized');
  }

  @Post('invite')
  @Auditable('user')
  async invite(
    @Headers('x-clinic-id') clinicId: string,
    @Headers('x-user-id') userId: string,
    @Body() inviteUserDto: InviteUserDto,
  ) {
    this.logger.log(`Inviting user: ${inviteUserDto.email} for clinicId: ${clinicId}`);
    const actor = await cargarActor(this.prisma, userId, clinicId);
    return this.usersService.invite(clinicId, actor, inviteUserDto);
  }

  @Get()
  async findAll(
    @Headers('x-clinic-id') clinicId: string,
    @Headers('x-user-id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    this.logger.log(`Fetching users for clinicId: ${clinicId} (page=${page}, limit=${limit})`);
    const actor = await cargarActor(this.prisma, userId, clinicId);
    return this.usersService.findAll(clinicId, actor, page, limit);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.logger.log(`Fetching user: ${id} for clinicId: ${clinicId}`);
    const actor = await cargarActor(this.prisma, userId, clinicId);
    return this.usersService.findOne(id, clinicId, actor);
  }

  @Patch(':id')
  @Auditable('user')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
    @Headers('x-user-id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    this.logger.log(`Updating user: ${id} for clinicId: ${clinicId}`);
    const actor = await cargarActor(this.prisma, userId, clinicId);
    return this.usersService.update(id, clinicId, actor, updateUserDto);
  }

  @Delete(':id')
  @Auditable('user')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.logger.log(`Removing user: ${id} for clinicId: ${clinicId}`);
    const actor = await cargarActor(this.prisma, userId, clinicId);
    return this.usersService.remove(id, clinicId, actor);
  }
}

