import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';

@Module({
  controllers: [DoctorController],
  providers: [DoctorService],
  exports: [DoctorService],
})
export class DoctorModule implements OnModuleInit {
  private readonly logger = new Logger(DoctorModule.name);

  onModuleInit() {
    this.logger.log('DoctorModule initialized');
  }
}

