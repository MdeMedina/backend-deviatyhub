import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { subDays, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class MetricsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getSummary(clinicId: string, period: string) {
    const days = parseInt(period) || 7;
    const fromDate = subDays(new Date(), days);
    
    // 1. Contador de conversaciones y citas
    const [convCount, appScheduled, appRescheduled, appCancelled] = await Promise.all([
      this.prisma.conversation.count({
        where: { clinicId, startedAt: { gte: fromDate } },
      }),
      this.prisma.metricsEvent.count({
        where: { clinicId, eventType: 'APPOINTMENT_SCHEDULED', createdAt: { gte: fromDate } },
      }),
      this.prisma.metricsEvent.count({
        where: { clinicId, eventType: 'APPOINTMENT_RESCHEDULED', createdAt: { gte: fromDate } },
      }),
      this.prisma.metricsEvent.count({
        where: { clinicId, eventType: 'APPOINTMENT_CANCELLED', createdAt: { gte: fromDate } },
      }),
    ]);

    // 2. Containment Rate (Porcentaje de conversaciones cerradas sin haber pasado por takeover)
    const takeovers = await this.prisma.metricsEvent.count({
        where: { clinicId, eventType: 'HUMAN_TAKEOVER', createdAt: { gte: fromDate } }
    });
    
    const containmentRate = convCount > 0 ? (convCount - takeovers) / convCount : 1;

    // 3. Distribución de intenciones
    const intentions = await this.prisma.metricsEvent.groupBy({
      by: ['intention'],
      where: {
        clinicId,
        eventType: 'INTENTION_DETECTED',
        createdAt: { gte: fromDate },
        intention: { not: null },
      },
      _count: { _all: true },
    });

    const intentionDistribution = intentions.map((i) => ({
      intention: i.intention,
      count: i._count._all,
      percentage: convCount > 0 ? (i._count._all / convCount) * 100 : 0,
    }));

    // 4. Interacciones por hora (Histograma 24h)
    // Nota: En un entorno de producción real esto se haría con un bucket de tiempo en SQL.
    // Aquí simulamos la agregación por la propiedad hourOfDay registrada en los eventos.
    const hourlyData = await this.prisma.metricsEvent.groupBy({
      by: ['hourOfDay'],
      where: {
        clinicId,
        createdAt: { gte: fromDate },
        hourOfDay: { not: null },
      },
      _count: { _all: true },
    });

    const interactionsByHour = Array.from({ length: 24 }, (_, hour) => {
      const found = hourlyData.find((d) => d.hourOfDay === hour);
      return { hour, count: found?._count._all || 0 };
    });

    return {
      period,
      from: fromDate,
      to: new Date(),
      conversations_attended: convCount,
      containment_rate: parseFloat(containmentRate.toFixed(2)),
      human_takeovers: takeovers,
      appointments_scheduled: appScheduled,
      appointments_rescheduled: appRescheduled,
      appointments_cancelled: appCancelled,
      intentions_distribution: intentionDistribution,
      interactions_by_hour: interactionsByHour,
    };
  }
}
