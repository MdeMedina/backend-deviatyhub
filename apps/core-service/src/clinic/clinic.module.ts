import { Module } from '@nestjs/common';
import { ClinicController } from './clinic.controller';
import { UnavailabilityController } from './unavailability.controller';
import { PoliciesController } from './policies.controller';
import { ClinicService } from './clinic.service';

@Module({
  controllers: [
    ClinicController,
    UnavailabilityController,
    PoliciesController,
  ],
  providers: [ClinicService],
  exports: [ClinicService],
})
export class ClinicModule {}
