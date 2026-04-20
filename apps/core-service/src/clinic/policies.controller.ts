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
import { CreatePolicyDto, UpdatePolicyDto } from './dto/clinic.dto';

@Controller('clinic/policies')
export class PoliciesController {
  constructor(
    @Inject(ClinicService)
    private readonly clinicService: ClinicService
  ) {}

  @Get()
  async findAll(@CurrentClinicId() clinicId: string) {
    return this.clinicService.getPolicies(clinicId);
  }

  @Post()
  @Auditable('policy')
  async create(
    @CurrentClinicId() clinicId: string,
    @Body() dto: CreatePolicyDto,
  ) {
    return this.clinicService.createPolicy(clinicId, dto);
  }

  @Patch(':id')
  @Auditable('policy')
  async update(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.clinicService.updatePolicy(clinicId, id, dto);
  }

  @Delete(':id')
  @Auditable('policy')
  async remove(@CurrentClinicId() clinicId: string, @Param('id') id: string) {
    return this.clinicService.deletePolicy(clinicId, id);
  }
}
