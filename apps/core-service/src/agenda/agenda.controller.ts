import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Inject,
} from '@nestjs/common';
import { Auditable, CurrentClinicId, CurrentUserId } from '@deviaty/shared-nestjs';
import { AgendaService } from './agenda.service';
import { DentalinkService } from '../dentalink/dentalink.service';
import { PrismaService } from '@deviaty/shared-prisma';
import { CreateAppointmentDto, UpdateStatusDto, RescheduleDto } from './dto/appointment.dto';

@Controller('agenda')
export class AgendaController {
  constructor(
    @Inject(AgendaService)
    private readonly agendaService: AgendaService,
    @Inject(DentalinkService) private readonly dentalink: DentalinkService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  // ─── Coordinación con Dentalink ────────────────────────────────────

  /** Citas agendadas, movidas o anuladas desde Dentral que falta repetir en Dentalink. */
  @Get('coordination')
  porCoordinar(@CurrentClinicId() clinicId: string) {
    return this.dentalink.porCoordinar(clinicId);
  }

  @Post('appointments/:id/coordinated')
  @Auditable('appointment')
  async marcarCoordinada(
    @CurrentClinicId() clinicId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    const u = userId ? await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }) : null;
    return this.dentalink.marcarCoordinada(clinicId, id, u?.email ?? 'personal');
  }

  @Post('coordination/sync')
  sincronizarDentalink(@CurrentClinicId() clinicId: string) {
    return this.dentalink.sincronizar(clinicId, 'manual');
  }

  @Get('slots')
  async getSlots(
    @CurrentClinicId() clinicId: string,
    @Query('date') date: string,
    @Query('treatment_id') treatmentId?: string,
    @Query('doctor_id') doctorId?: string
  ) {
    return this.agendaService.getAvailableSlots(clinicId, date, treatmentId, doctorId);
  }

  @Get('appointments')
  async findAll(
    @CurrentClinicId() clinicId: string,
    @CurrentUserId() userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('doctor_id') doctorId?: string
  ) {
    return this.agendaService.findAllAppointments(clinicId, startDate, endDate, doctorId, userId);
  }

  @Get('absences')
  async findAbsences(
    @CurrentClinicId() clinicId: string,
    @CurrentUserId() userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.agendaService.findAbsences(clinicId, startDate, endDate, userId);
  }

  @Get('appointments/:id')
  async findOne(
    @CurrentClinicId() clinicId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string
  ) {
    return this.agendaService.findOneAppointment(clinicId, id, userId);
  }

  @Post('appointments')
  @Auditable('appointment')
  async create(
    @CurrentClinicId() clinicId: string,
    @Body() dto: CreateAppointmentDto
  ) {
    return this.agendaService.createAppointment(clinicId, dto);
  }

  @Patch('appointments/:id/status')
  @Auditable('appointment')
  async updateStatus(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto
  ) {
    return this.agendaService.updateStatus(clinicId, id, dto.status, dto.notes);
  }

  @Patch('appointments/:id/reschedule')
  @Auditable('appointment')
  async reschedule(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: RescheduleDto
  ) {
    return this.agendaService.reschedule(clinicId, id, dto.scheduled_at, dto.notes);
  }
}
