import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ClinicController } from './clinic.controller';
import { UnavailabilityController } from './unavailability.controller';
import { PoliciesController } from './policies.controller';
import { AgentConfigController } from './agent-config.controller';
import { IntegrationsController } from './integrations.controller';
import { ClinicService } from './clinic.service';

@Module({
  controllers: [
    ClinicController,
    UnavailabilityController,
    PoliciesController,
    AgentConfigController,
    IntegrationsController,
  ],
  providers: [ClinicService],
  exports: [ClinicService],
})
export class ClinicModule implements OnModuleInit {
  private readonly logger = new Logger(ClinicModule.name);

  onModuleInit() {
    this.logger.log('ClinicModule initialized');
  }
}

