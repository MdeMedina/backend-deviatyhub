import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '@deviaty/shared-nestjs';
import { PlatformAdminGuard } from './platform.guard';
import { PlatformService } from './platform.service';
import { PlatformWhatsAppService } from './platform-whatsapp.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { ImpactService } from '../metrics/impact.service';
import { PrismaService } from '@deviaty/shared-prisma';
import { CommercialDto, CreateClinicDto, InviteClinicUserDto, UpdateAccessDto, UpdateClinicDto, WhatsAppOwnDto } from './dto/platform.dto';

/** Backoffice del equipo de la plataforma. Nada de aquí depende de la clínica del usuario. */
@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformController {
  constructor(
    @Inject(PlatformService) private readonly platform: PlatformService,
    @Inject(PlatformWhatsAppService) private readonly whatsapp: PlatformWhatsAppService,
    @Inject(PlatformMetricsService) private readonly metricas: PlatformMetricsService,
    @Inject(ImpactService) private readonly impacto: ImpactService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  // ─── Métricas ─────────────────────────────────────────────────────

  @Get('metrics/health')
  salud(@Query('days') days?: string) {
    return this.metricas.salud(dias(days));
  }

  @Get('metrics/clinics')
  metricasPorClinica(@Query('days') days?: string) {
    return this.metricas.porClinica(dias(days));
  }

  @Get('clinics/:id/impact')
  impactoDeClinica(@Param('id', ParseUUIDPipe) id: string, @Query('days') days?: string) {
    return this.impacto.impacto(id, dias(days));
  }

  @Get('clinics/:id/commercial')
  async comercial(@Param('id', ParseUUIDPipe) id: string) {
    return (await this.impacto.comercial(id)) ?? { clinicId: id, monthlyFeeUsd: 99, usdRate: 950, currency: 'CLP' };
  }

  @Put('clinics/:id/commercial')
  async guardarComercial(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CommercialDto) {
    const existe = await this.prisma.clinic.findFirst({ where: { id, internal: false }, select: { id: true } });
    if (!existe) throw new NotFoundException('No existe esa clínica.');
    const datos = {
      ...dto,
      pilotStartedAt: dto.pilotStartedAt ? new Date(dto.pilotStartedAt) : dto.pilotStartedAt === null ? null : undefined,
      lostConsultationsWeek: dto.lostConsultationsWeek == null ? dto.lostConsultationsWeek : Math.round(dto.lostConsultationsWeek),
      firstResponseTimeSec: dto.firstResponseTimeSec == null ? dto.firstResponseTimeSec : Math.round(dto.firstResponseTimeSec),
    } as any;
    return this.prisma.clinicCommercial.upsert({
      where: { clinicId: id },
      create: { clinicId: id, ...datos },
      update: datos,
    });
  }

  // ─── WhatsApp de cada clínica ──────────────────────────────────────

  @Get('clinics/:id/whatsapp')
  whatsappEstado(@Param('id', ParseUUIDPipe) id: string) {
    return this.whatsapp.estado(id);
  }

  @Post('clinics/:id/whatsapp/dentral')
  whatsappDentral(@Param('id', ParseUUIDPipe) id: string) {
    return this.whatsapp.asignarNumeroDentral(id);
  }

  @Post('clinics/:id/whatsapp/own')
  whatsappPropio(@Param('id', ParseUUIDPipe) id: string, @Body() dto: WhatsAppOwnDto) {
    return this.whatsapp.configurarPropio(id, dto);
  }

  @Post('clinics/:id/whatsapp/verify')
  whatsappVerificar(@Param('id', ParseUUIDPipe) id: string) {
    return this.whatsapp.verificar(id);
  }

  @Post('clinics/:id/whatsapp/subscribe')
  whatsappSuscribir(@Param('id', ParseUUIDPipe) id: string) {
    return this.whatsapp.suscribirWebhooks(id);
  }

  @Delete('clinics/:id/whatsapp')
  whatsappDesconectar(@Param('id', ParseUUIDPipe) id: string) {
    return this.whatsapp.desconectar(id);
  }

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

  @Post('team/:userId/resend-invite')
  resendTeamInvite(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.platform.resendTeamInvite(userId);
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

/** Ventana en días: 30 por defecto, entre 1 y 365. */
function dias(valor?: string): number {
  return Math.min(Math.max(parseInt(valor || '30') || 30, 1), 365);
}
