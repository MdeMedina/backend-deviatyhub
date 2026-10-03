import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '@deviaty/shared-nestjs';
import { PlatformAdminGuard } from './platform.guard';
import { PlatformService } from './platform.service';
import { CreateClinicDto, InviteClinicUserDto, UpdateAccessDto, UpdateClinicDto } from './dto/platform.dto';

/** Backoffice del equipo de la plataforma. Nada de aquí depende de la clínica del usuario. */
@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get('overview')
  overview() {
    return this.platform.overview();
  }

  @Get('team')
  listTeam(@CurrentUserId() userId: string) {
    return this.platform.listTeam(userId);
  }

  @Post('team')
  inviteTeamMember(@Body() dto: InviteClinicUserDto) {
    return this.platform.inviteTeamMember(dto.email);
  }

  @Delete('team/:userId')
  revokeTeamMember(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUserId() actual: string) {
    return this.platform.revokeTeamMember(userId, actual);
  }

  @Get('clinics')
  listClinics() {
    return this.platform.listClinics();
  }

  @Post('clinics')
  createClinic(@Body() dto: CreateClinicDto) {
    return this.platform.createClinic(dto);
  }

  @Get('clinics/:id')
  getClinic(@Param('id', ParseUUIDPipe) id: string) {
    return this.platform.getClinic(id);
  }

  @Patch('clinics/:id')
  updateClinic(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClinicDto) {
    return this.platform.updateClinic(id, dto);
  }

  @Patch('clinics/:id/access')
  updateAccess(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAccessDto) {
    return this.platform.updateAccess(id, dto);
  }

  @Post('clinics/:id/users')
  inviteAdmin(@Param('id', ParseUUIDPipe) id: string, @Body() dto: InviteClinicUserDto) {
    return this.platform.inviteAdmin(id, dto);
  }

  @Post('clinics/:id/users/:userId/resend-invite')
  resendInvite(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.platform.resendInvite(id, userId);
  }
}
