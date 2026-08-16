import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TreatmentController } from './treatment.controller';
import { TreatmentService } from './treatment.service';

@Module({
  controllers: [TreatmentController],
  providers: [TreatmentService],
  exports: [TreatmentService],
})
export class TreatmentModule implements OnModuleInit {
  private readonly logger = new Logger(TreatmentModule.name);

  onModuleInit() {
    this.logger.log('TreatmentModule initialized');
  }
}

