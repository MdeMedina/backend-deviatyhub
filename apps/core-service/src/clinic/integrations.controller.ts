import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Inject,
} from '@nestjs/common';
import { CurrentClinicId } from '@deviaty/shared-nestjs';
import { ClinicService } from './clinic.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    @Inject(ClinicService)
    private readonly clinicService: ClinicService,
  ) {}

  @Get()
  async getIntegrations(@CurrentClinicId() clinicId: string) {
    return this.clinicService.getIntegrations(clinicId);
  }

  @Get(':type')
  async getIntegrationDetails(
    @CurrentClinicId() clinicId: string,
    @Param('type') type: string,
  ) {
    return this.clinicService.getIntegrationDetails(clinicId, type);
  }

  @Put(':type')
  async saveCredentials(
    @CurrentClinicId() clinicId: string,
    @Param('type') type: string,
    @Body() credentials: Record<string, string>,
  ) {
    return this.clinicService.saveCredentials(clinicId, type, credentials);
  }

  @Post(':type/test')
  async testConnection(
    @CurrentClinicId() clinicId: string,
    @Param('type') type: string,
  ) {
    return this.clinicService.testConnection(clinicId, type);
  }
}
