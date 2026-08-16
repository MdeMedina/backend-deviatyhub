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
import { UsersService } from './users.service';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';
import { Auditable } from '../common/decorators/auditable.decorator';

@Controller('auth/users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService,
  ) {
    this.logger.log('UsersController initialized');
  }

  @Post('invite')
  @Auditable('user')
  invite(
    @Headers('x-clinic-id') clinicId: string,
    @Body() inviteUserDto: InviteUserDto,
  ) {
    this.logger.log(`Inviting user: ${inviteUserDto.email} for clinicId: ${clinicId}`);
    return this.usersService.invite(clinicId, inviteUserDto);
  }

  @Get()
  findAll(
    @Headers('x-clinic-id') clinicId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    this.logger.log(`Fetching users for clinicId: ${clinicId} (page=${page}, limit=${limit})`);
    return this.usersService.findAll(clinicId, page, limit);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
  ) {
    this.logger.log(`Fetching user: ${id} for clinicId: ${clinicId}`);
    return this.usersService.findOne(id, clinicId);
  }

  @Patch(':id')
  @Auditable('user')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    this.logger.log(`Updating user: ${id} for clinicId: ${clinicId}`);
    return this.usersService.update(id, clinicId, updateUserDto);
  }

  @Delete(':id')
  @Auditable('user')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
  ) {
    this.logger.log(`Removing user: ${id} for clinicId: ${clinicId}`);
    return this.usersService.remove(id, clinicId);
  }
}

