import { Module } from '@nestjs/common';
import { DentalinkService } from './dentalink.service';

@Module({
  providers: [DentalinkService],
  exports: [DentalinkService],
})
export class DentalinkModule {}
