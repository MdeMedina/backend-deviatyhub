import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Inject,
} from '@nestjs/common';
import {
  Auditable,
  CurrentClinicId,
} from '@deviaty/shared-nestjs';
import { ClinicService } from './clinic.service';
import {
  CreateUnavailabilityDto,
  UpdateUnavailabilityDto,
} from './dto/clinic.dto';

@Controller('clinic/unavailability')
export class UnavailabilityController {
  constructor(
    @Inject(ClinicService)
    private readonly clinicService: ClinicService
  ) {}

  @Get()
  async findAll(@CurrentClinicId() clinicId: string) {
    return this.clinicService.getUnavailability(clinicId);
  }

  @Post()
  @Auditable('unavailabilityBlock')
  async create(
    @CurrentClinicId() clinicId: string,
    @Body() dto: CreateUnavailabilityDto,
  ) {
    return this.clinicService.createUnavailability(clinicId, dto);
  }

  @Patch(':id')
  @Auditable('unavailabilityBlock')
  async update(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUnavailabilityDto,
  ) {
    return this.clinicService.updateUnavailability(clinicId, id, dto);
  }

  @Delete(':id')
  @Auditable('unavailabilityBlock')
  async remove(@CurrentClinicId() clinicId: string, @Param('id') id: string) {
    return this.clinicService.deleteUnavailability(clinicId, id);
  }
}
