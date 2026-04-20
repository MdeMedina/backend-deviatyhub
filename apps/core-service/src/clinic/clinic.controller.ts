import {
  Controller,
  Get,
  Patch,
  Put,
  Body,
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import {
  Auditable,
  CurrentClinicId,
} from '@deviaty/shared-nestjs';
import { ClinicService } from './clinic.service';
import { UpdateClinicConfigDto, UpdateSchedulesDto } from './dto/clinic.dto';

@Controller('clinic')
export class ClinicController {
  constructor(
    @Inject(ClinicService)
    private readonly clinicService: ClinicService
  ) {}

  @Get('config')
  async getConfig(@CurrentClinicId() clinicId: string) {
    return this.clinicService.getConfig(clinicId);
  }

  @Patch('config')
  @Auditable('clinicConfig')
  async updateConfig(
    @CurrentClinicId() clinicId: string,
    @Body() dto: UpdateClinicConfigDto,
  ) {
    return this.clinicService.updateConfig(clinicId, dto);
  }

  @Get('schedules')
  async getSchedules(@CurrentClinicId() clinicId: string) {
    return this.clinicService.getSchedules(clinicId);
  }

  @Put('schedules')
  @Auditable('clinicSchedule')
  async updateSchedules(
    @CurrentClinicId() clinicId: string,
    @Body() dto: UpdateSchedulesDto,
  ) {
    return this.clinicService.updateSchedules(clinicId, dto);
  }
}
