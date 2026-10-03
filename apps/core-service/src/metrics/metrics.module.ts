import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { ImpactService } from './impact.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, ImpactService],
  exports: [MetricsService, ImpactService],
})
export class MetricsModule implements OnModuleInit {
  private readonly logger = new Logger(MetricsModule.name);

  onModuleInit() {
    this.logger.log('MetricsModule initialized');
  }
}

