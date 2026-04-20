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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';
import { Auditable } from '../common/decorators/auditable.decorator';

@Controller('auth/users')
export class UsersController {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService,
  ) {}

  @Post('invite')
  @Auditable('user')
  invite(
    @Headers('x-clinic-id') clinicId: string,
    @Body() inviteUserDto: InviteUserDto,
  ) {
    return this.usersService.invite(clinicId, inviteUserDto);
  }

  @Get()
  findAll(
    @Headers('x-clinic-id') clinicId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.findAll(clinicId, page, limit);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
  ) {
    return this.usersService.findOne(id, clinicId);
  }

  @Patch(':id')
  @Auditable('user')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, clinicId, updateUserDto);
  }

  @Delete(':id')
  @Auditable('user')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
  ) {
    return this.usersService.remove(id, clinicId);
  }
}
