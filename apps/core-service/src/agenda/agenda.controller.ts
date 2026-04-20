import {
  Controller,
  Get,
  Query,
  Inject,
} from '@nestjs/common';
import { CurrentClinicId } from '@deviaty/shared-nestjs';
import { AgendaService } from './agenda.service';

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
}
