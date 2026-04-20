import {
  Controller,
  Get,
  Query,
  Inject,
} from '@nestjs/common';
import { CurrentClinicId } from '@deviaty/shared-nestjs';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(MetricsService)
    private readonly metricsService: MetricsService
  ) {}

  @Get('summary')
  async getSummary(
    @CurrentClinicId() clinicId: string,
    @Query('period') period: string
  ) {
    return this.metricsService.getSummary(clinicId, period);
  }
}
