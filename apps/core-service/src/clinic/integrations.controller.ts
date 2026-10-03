import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Inject,
  Headers,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Las integraciones las configura el equipo de la plataforma desde el
 * backoffice: son delicadas (Meta, tokens, webhooks) y un error deja a la
 * clínica sin recibir mensajes. La clínica las ve, pero no las cambia.
 */
function soloPlataforma(platformAdmin: string | undefined) {
  if (platformAdmin !== 'true') {
    throw new ForbiddenException('Las integraciones las configura el equipo de Dentral. Escríbenos para cambiarlas.');
  }
}
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
    @Headers('x-platform-admin') platformAdmin?: string,
  ) {
    soloPlataforma(platformAdmin);
    return this.clinicService.saveCredentials(clinicId, type, credentials);
  }

  @Post(':type/test')
  async testConnection(
    @CurrentClinicId() clinicId: string,
    @Param('type') type: string,
    @Headers('x-platform-admin') platformAdmin?: string,
  ) {
    soloPlataforma(platformAdmin);
    return this.clinicService.testConnection(clinicId, type);
  }
}
