import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { subDays } from 'date-fns';

/**
 * Las métricas se calculan directamente sobre las tablas de origen
 * (conversations, messages, appointments y su historial).
 *
 * La versión anterior leía de metrics_events, una tabla que ningún servicio
 * llegó a poblar: el panel mostraba ceros para todo lo basado en eventos
 * (intenciones, histograma horario, citas) aunque hubiera actividad real.
 * Calcular desde el origen da además el histórico y evita una segunda fuente
 * de verdad que se desincronice.
 */
@Injectable()
export class MetricsService {
  // La hora local importa para el histograma y para "fuera de horario":
  // started_at/sent_at son timestamptz y sin convertir se agruparían en UTC.
  private readonly tz = process.env.CLINIC_TIMEZONE || 'America/Santiago';

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getSummary(clinicId: string, period: string) {
    const days = parseInt(period) || 7;
    const to = new Date();
    const from = subDays(to, days);
    // Ventana anterior del mismo tamaño, para calcular las tendencias reales.
    const prevFrom = subDays(from, days);

    const [current, previous, intentions, byHour] = await Promise.all([
      this.collectWindow(clinicId, from, to),
      this.collectWindow(clinicId, prevFrom, from),
      this.intentionsDistribution(clinicId, from, to),
      this.interactionsByHour(clinicId, from, to),
    ]);

    return {
      period,
      from,
      to,
      ...current,
      intentions_distribution: intentions,
      interactions_by_hour: byHour,
      // null = no hay periodo anterior con el que comparar; el front no debe
      // inventar un porcentaje en ese caso.
      trends: {
        conversations_attended: pctChange(previous.conversations_attended, current.conversations_attended),
        containment_rate: pctChange(previous.containment_rate, current.containment_rate),
        avg_response_time_ms: pctChange(previous.avg_response_time_ms, current.avg_response_time_ms),
        appointments_scheduled: pctChange(previous.appointments_scheduled, current.appointments_scheduled),
        appointments_rescheduled: pctChange(previous.appointments_rescheduled, current.appointments_rescheduled),
        appointments_cancelled: pctChange(previous.appointments_cancelled, current.appointments_cancelled),
        human_takeovers: pctChange(previous.human_takeovers, current.human_takeovers),
        out_of_hours_conversations: pctChange(previous.out_of_hours_conversations, current.out_of_hours_conversations),
      },
    };
  }

  /** Todos los contadores de una ventana temporal. */
  private async collectWindow(clinicId: string, from: Date, to: Date) {
    const notSimulator = { channel: { not: 'SIMULATOR' as any } };

    const [convCount, takeovers, scheduled, rescheduled, cancelled, avgMs, outOfHours] =
      await Promise.all([
        this.prisma.conversation.count({
          where: { clinicId, startedAt: { gte: from, lt: to }, ...notSimulator },
        }),
        // Una conversación cuenta como derivada si está en takeover o si quedó
        // asignada a una persona del equipo.
        this.prisma.conversation.count({
          where: {
            clinicId,
            startedAt: { gte: from, lt: to },
            ...notSimulator,
            OR: [{ status: 'HUMAN_TAKEOVER' as any }, { assignedUserId: { not: null } }],
          },
        }),
        // Solo las que agendó el agente a partir de una conversación real.
        // Contar todas las filas de appointments inflaba el panel con los datos
        // de demostración del seed (contacto ficticio, sin conversación), que
        // además se recrean en cada despliegue y por eso siempre caían dentro
        // del periodo. Las citas que carga el equipo a mano tampoco entran
        // aquí: esta métrica mide lo agendado de forma autónoma.
        this.prisma.appointment.count({
          where: {
            clinicId,
            createdAt: { gte: from, lt: to },
            source: 'AGENT',
            conversationId: { not: null },
          },
        }),
        this.countHistoryEvents(clinicId, from, to, ['rescheduled', 'status_changed_rescheduled']),
        this.countHistoryEvents(clinicId, from, to, ['cancelled', 'status_changed_cancelled']),
        this.avgResponseMs(clinicId, from, to),
        this.outOfHoursCount(clinicId, from, to),
      ]);

    return {
      conversations_attended: convCount,
      containment_rate: convCount > 0 ? round2((convCount - takeovers) / convCount) : null,
      human_takeovers: takeovers,
      appointments_scheduled: scheduled,
      appointments_rescheduled: rescheduled,
      appointments_cancelled: cancelled,
      avg_response_time_ms: avgMs,
      out_of_hours_conversations: outOfHours,
    };
  }

  private async countHistoryEvents(clinicId: string, from: Date, to: Date, events: string[]) {
    return this.prisma.appointmentHistory.count({
      where: {
        event: { in: events },
        createdAt: { gte: from, lt: to },
        appointment: { clinicId },
      },
    });
  }

  /**
   * Tiempo medio que tarda el agente en contestar: diferencia entre cada
   * mensaje ASSISTANT y el último mensaje USER que lo precede en esa misma
   * conversación. Devuelve null si todavía no hay ningún par.
   */
  private async avgResponseMs(clinicId: string, from: Date, to: Date): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<{ avg_ms: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (t.sent_at - t.prev_user_at)) * 1000)::float AS avg_ms
      FROM (
        SELECT m.role, m.sent_at,
               MAX(CASE WHEN m.role = 'USER' THEN m.sent_at END) OVER (
                 PARTITION BY m.conversation_id ORDER BY m.sent_at
                 ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
               ) AS prev_user_at
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE m.clinic_id = ${clinicId}::uuid
          AND m.sent_at >= ${from} AND m.sent_at < ${to}
          AND c.channel <> 'SIMULATOR'
      ) t
      WHERE t.role = 'ASSISTANT' AND t.prev_user_at IS NOT NULL
    `;
    const avg = rows?.[0]?.avg_ms;
    return avg == null ? null : Math.round(avg);
  }

  /** Conversaciones iniciadas con la clínica cerrada, según clinic_schedules. */
  private async outOfHoursCount(clinicId: string, from: Date, to: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM conversations c
      LEFT JOIN clinic_schedules s
        ON s.clinic_id = c.clinic_id
       AND s.day_of_week = EXTRACT(DOW FROM (c.started_at AT TIME ZONE ${this.tz}))
      WHERE c.clinic_id = ${clinicId}::uuid
        AND c.started_at >= ${from} AND c.started_at < ${to}
        AND c.channel <> 'SIMULATOR'
        AND (
          s.id IS NULL
          OR s.is_open = false
          OR to_char(c.started_at AT TIME ZONE ${this.tz}, 'HH24:MI') < s.open_time
          OR to_char(c.started_at AT TIME ZONE ${this.tz}, 'HH24:MI') >= s.close_time
        )
    `;
    return Number(rows?.[0]?.count ?? 0);
  }

  /** Histograma de mensajes por hora local de la clínica. */
  private async interactionsByHour(clinicId: string, from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<{ hour: number; count: bigint }[]>`
      SELECT EXTRACT(HOUR FROM (m.sent_at AT TIME ZONE ${this.tz}))::int AS hour,
             COUNT(*) AS count
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.clinic_id = ${clinicId}::uuid
        AND m.sent_at >= ${from} AND m.sent_at < ${to}
        AND c.channel <> 'SIMULATOR'
      GROUP BY 1
    `;
    const map = new Map(rows.map((r) => [Number(r.hour), Number(r.count)]));
    return Array.from({ length: 24 }, (_, hour) => ({ hour, count: map.get(hour) ?? 0 }));
  }

  /**
   * Distribución de intenciones a partir del intent que el clasificador deja
   * guardado en langchain_meta de cada mensaje del paciente. Los mensajes
   * anteriores a que se empezara a persistir no lo tienen, así que no aparecen.
   */
  private async intentionsDistribution(clinicId: string, from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<{ intention: string; count: bigint }[]>`
      SELECT m.langchain_meta->>'intent' AS intention, COUNT(*) AS count
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.clinic_id = ${clinicId}::uuid
        AND m.sent_at >= ${from} AND m.sent_at < ${to}
        AND c.channel <> 'SIMULATOR'
        AND m.role = 'USER'
        AND m.langchain_meta->>'intent' IS NOT NULL
      GROUP BY 1
      ORDER BY 2 DESC
    `;
    const total = rows.reduce((acc, r) => acc + Number(r.count), 0);
    return rows.map((r) => ({
      intention: r.intention,
      count: Number(r.count),
      percentage: total > 0 ? round2((Number(r.count) / total) * 100) : 0,
    }));
  }
}

function round2(n: number) {
  return parseFloat(n.toFixed(2));
}

/** Variación porcentual respecto al periodo anterior. null si no es comparable. */
function pctChange(prev: number | null, curr: number | null): number | null {
  if (prev == null || curr == null) return null;
  // Sin actividad en ninguna de las dos ventanas no hay nada que comparar:
  // un "0,0%" daría a entender que sí se midió algo y se mantuvo estable.
  if (prev === 0 && curr === 0) return null;
  // Partir de cero hace la variación porcentual indefinida (división por cero).
  if (prev === 0) return null;
  return round2(((curr - prev) / Math.abs(prev)) * 100);
}
