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
import { Auditable, CurrentClinicId } from '@deviaty/shared-nestjs';
import { AgendaService } from './agenda.service';
import { CreateAppointmentDto, UpdateStatusDto, RescheduleDto } from './dto/appointment.dto';

@Controller('agenda')
export class AgendaController {
  constructor(
    @Inject(AgendaService)
    private readonly agendaService: AgendaService
  ) {}

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
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctor_id') doctorId?: string
  ) {
    return this.agendaService.findAllAppointments(clinicId, from, to, doctorId);
  }

  @Get('appointments/:id')
  async findOne(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string
  ) {
    return this.agendaService.findOneAppointment(clinicId, id);
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
