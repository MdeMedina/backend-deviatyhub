import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformAdminGuard } from './platform.guard';
import { PlatformWhatsAppService } from './platform-whatsapp.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformWhatsAppService, PlatformMetricsService, PlatformAdminGuard],
})
export class PlatformModule {}
