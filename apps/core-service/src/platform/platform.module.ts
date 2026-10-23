import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformAdminGuard } from './platform.guard';
import { PlatformWhatsAppService } from './platform-whatsapp.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { PlatformPromptService } from './platform-prompt.service';
import { MetricsModule } from '../metrics/metrics.module';
import { DentalinkModule } from '../dentalink/dentalink.module';

@Module({
  imports: [MetricsModule, DentalinkModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformWhatsAppService, PlatformMetricsService, PlatformPromptService, PlatformAdminGuard],
})
export class PlatformModule {}
