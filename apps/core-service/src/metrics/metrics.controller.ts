import {
  Controller,
  Get,
  Query,
  Inject,
} from '@nestjs/common';
import { CurrentClinicId } from '@deviaty/shared-nestjs';
import { MetricsService } from './metrics.service';
import { ImpactService } from './impact.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(MetricsService)
    private readonly metricsService: MetricsService,
    @Inject(ImpactService)
    private readonly impact: ImpactService,
  ) {}

  /** Impacto del agente: ingreso, asistencia, conversión, 24/7, respuesta, autonomía, horas. */
  @Get('impact')
  async getImpact(@CurrentClinicId() clinicId: string, @Query('period') period?: string) {
    const dias = Math.min(Math.max(parseInt(period || '30') || 30, 1), 365);
    return this.impact.impacto(clinicId, dias);
  }

  /** Garantía del mes en curso y del anterior. */
  @Get('roi-guarantee')
  async getGuarantee(@CurrentClinicId() clinicId: string) {
    return this.impact.garantia(clinicId);
  }

  @Get('summary')
  async getSummary(
    @CurrentClinicId() clinicId: string,
    @Query('period') period: string
  ) {
    return this.metricsService.getSummary(clinicId, period);
  }
}
