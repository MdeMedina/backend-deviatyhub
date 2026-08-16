import {
  Controller,
  Get,
  Patch,
  Put,
  Body,
  Inject,
} from '@nestjs/common';
import {
  Auditable,
  CurrentClinicId,
} from '@deviaty/shared-nestjs';
import { ClinicService } from './clinic.service';

@Controller('agent-config')
export class AgentConfigController {
  constructor(
    @Inject(ClinicService)
    private readonly clinicService: ClinicService
  ) {}

  @Get()
  async getAgentConfig(@CurrentClinicId() clinicId: string) {
    return this.clinicService.getAgentConfig(clinicId);
  }

  @Patch()
  @Auditable('agentConfig')
  async updateAgentConfig(
    @CurrentClinicId() clinicId: string,
    @Body() dto: { actions: any }
  ) {
    return this.clinicService.updateAgentConfig(clinicId, dto);
  }

  @Put()
  @Auditable('agentConfig')
  async updateAgentConfigPut(
    @CurrentClinicId() clinicId: string,
    @Body() dto: { actions: any }
  ) {
    return this.clinicService.updateAgentConfig(clinicId, dto);
  }
}
