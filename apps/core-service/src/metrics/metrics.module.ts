import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule implements OnModuleInit {
  private readonly logger = new Logger(MetricsModule.name);

  onModuleInit() {
    this.logger.log('MetricsModule initialized');
  }
}

