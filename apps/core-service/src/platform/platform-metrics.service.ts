import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { subDays, subHours } from 'date-fns';
import { ImpactService } from '../metrics/impact.service';

/** Metas y umbrales de la especificación (sección 3). */
export const SLA = {
  unansweredAfterSec: 60,
  latencyP50Ms: 4000,
  latencyP95Ms: 12000,
  webhookMs: 200,
  webhookAlertMs: 1000,
  queueDepth: 50,
  queueDepthAlert: 200,
  queueAgeAlertSec: 30,
  parseErrorRate: 0.005,
  parseErrorAlertRate: 0.02,
  unitCostMinUsd: 41,
  unitCostMaxUsd: 58,
  dailyCostAlertUsd: 2.5,
};

type Percentiles = { p50: number | null; p95: number | null };

/**
 * Métricas técnicas de la plataforma, para el backoffice: latencia, cola,
 * fiabilidad del modelo, costo y mensajes sin respuesta, más el resumen de
 * negocio de cada clínica. Lo técnico sale de agent_turns, que se llena desde
 * el despliegue que lo introdujo: antes de eso no hay datos.
 */
@Injectable()
export class PlatformMetricsService {
  private readonly logger = new Logger(PlatformMetricsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ImpactService) private readonly impacto: ImpactService,
  ) {}

  async salud(dias: number) {
    const to = new Date();
    const from = subDays(to, dias);
    const [latencia, turnos, cola, sinRespuesta, costo24h, primerTurno] = await Promise.all([
      this.latencias(from, to),
      this.resumenDeTurnos(from, to),
      this.cola(),
      this.mensajesSinRespuesta(),
      this.prisma.agentTurn.aggregate({ where: { createdAt: { gte: subHours(to, 24) } }, _sum: { costUsd: true } }),
      this.prisma.agentTurn.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ]);

    const costo = turnos.costo;
    return {
      period_days: dias,
      range: { from, to },
      // Desde cuándo hay telemetría: antes de esa fecha los turnos no se medían.
      telemetry_since: primerTurno?.createdAt ?? null,
      sla: SLA,
      unanswered: sinRespuesta,
      latency: latencia,
      queue: cola,
      llm: {
        turns: turnos.total,
        replied: turnos.porDesenlace.replied ?? 0,
        errors: turnos.porDesenlace.error ?? 0,
        error_rate: turnos.total ? round3((turnos.porDesenlace.error ?? 0) / turnos.total) : null,
        parse_errors: turnos.parseErrors,
        parse_error_rate: turnos.conModelo ? round3(turnos.parseErrors / turnos.conModelo) : null,
        by_outcome: turnos.porDesenlace,
        prompt_tokens: turnos.entrada,
        completion_tokens: turnos.salida,
      },
      cost: {
        total_usd: round2(costo),
        last_24h_usd: round2(costo24h._sum.costUsd ?? 0),
        projected_month_usd: round2((costo / dias) * 30),
        simulator_usd: round2(turnos.costoSimulador),
      },
      // Piezas de la especificación que no existen en la plataforma: se dicen
      // como tales en vez de mostrar un número.
      not_available: {
        pms: 'No hay integración con Dentalink, Dentidesk ni Google Calendar: no hay transacciones con un sistema de fichas que medir.',
        rag: 'El agente no usa búsqueda vectorial: el conocimiento de la clínica va completo en el prompt.',
      },
    };
  }

  /** Negocio y costo por clínica, para comparar entre ellas. */
  async porClinica(dias: number) {
    const to = new Date();
    const from = subDays(to, dias);
    const [clinicas, costos] = await Promise.all([
      this.prisma.clinic.findMany({
        where: { internal: false },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, active: true },
      }),
      this.prisma.agentTurn.groupBy({
        by: ['clinicId'],
        where: { createdAt: { gte: from, lt: to } },
        _sum: { costUsd: true },
        _count: { _all: true },
      }),
    ]);
    const costoDe = new Map(costos.map((c) => [c.clinicId, c]));

    return Promise.all(
      clinicas.map(async (c) => {
        const [imp, gar] = await Promise.all([this.impacto.impacto(c.id, dias), this.impacto.garantia(c.id)]);
        const costo = costoDe.get(c.id)?._sum.costUsd ?? 0;
        return {
          id: c.id,
          name: c.name,
          active: c.active !== false,
          currency: imp.currency,
          turns: costoDe.get(c.id)?._count._all ?? 0,
          ai_cost_usd: round2(costo),
          ai_cost_month_usd: round2((costo / dias) * 30),
          agent_appointments: imp.business.agent_appointments,
          attended: imp.business.attended_appointments,
          unmarked: imp.business.unmarked_appointments,
          estimated_revenue: imp.business.estimated_revenue,
          autonomy_rate: imp.business.autonomy_rate,
          first_response_p50_sec: imp.business.first_response_p50_sec,
          guarantee: { current: gar.current_month, previous: gar.previous_month },
        };
      }),
    );
  }

  // ─── Cálculos ─────────────────────────────────────────────────────────

  private async latencias(from: Date, to: Date) {
    const filas = await this.prisma.$queryRaw<
      {
        e2e_p50: number | null; e2e_p95: number | null;
        llm_p50: number | null; llm_p95: number | null;
        queue_p95: number | null; webhook_p95: number | null;
      }[]
    >`
      SELECT
        percentile_cont(0.5)  WITHIN GROUP (ORDER BY end_to_end_ms)::float AS e2e_p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY end_to_end_ms)::float AS e2e_p95,
        percentile_cont(0.5)  WITHIN GROUP (ORDER BY llm_ms)::float        AS llm_p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY llm_ms)::float        AS llm_p95,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY queue_ms)::float      AS queue_p95,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY webhook_ms)::float    AS webhook_p95
      FROM agent_turns
      WHERE created_at >= ${from} AND created_at < ${to}
        AND simulated = false
        AND outcome = 'replied'
    `;
    const f = filas?.[0] || ({} as any);
    const r = (v: number | null | undefined) => (v == null ? null : Math.round(v));
    return {
      end_to_end: { p50: r(f.e2e_p50), p95: r(f.e2e_p95) } as Percentiles,
      llm: { p50: r(f.llm_p50), p95: r(f.llm_p95) } as Percentiles,
      queue_p95_ms: r(f.queue_p95),
      webhook_p95_ms: r(f.webhook_p95),
    };
  }

  private async resumenDeTurnos(from: Date, to: Date) {
    const [porDesenlace, totales, simulador] = await Promise.all([
      this.prisma.agentTurn.groupBy({
        by: ['outcome'],
        where: { createdAt: { gte: from, lt: to }, simulated: false },
        _count: { _all: true },
      }),
      this.prisma.agentTurn.aggregate({
        where: { createdAt: { gte: from, lt: to } },
        _sum: { costUsd: true, promptTokens: true, completionTokens: true },
      }),
      this.prisma.agentTurn.aggregate({
        where: { createdAt: { gte: from, lt: to }, simulated: true },
        _sum: { costUsd: true },
      }),
    ]);
    const [parseErrors, conModelo] = await Promise.all([
      this.prisma.agentTurn.count({ where: { createdAt: { gte: from, lt: to }, parseError: true } }),
      this.prisma.agentTurn.count({ where: { createdAt: { gte: from, lt: to }, model: { not: null } } }),
    ]);
    const mapa = Object.fromEntries(porDesenlace.map((d) => [d.outcome, d._count._all])) as Record<string, number>;
    return {
      total: Object.values(mapa).reduce((s, n) => s + n, 0),
      porDesenlace: mapa,
      parseErrors,
      conModelo,
      costo: totales._sum.costUsd ?? 0,
      costoSimulador: simulador._sum.costUsd ?? 0,
      entrada: totales._sum.promptTokens ?? 0,
      salida: totales._sum.completionTokens ?? 0,
    };
  }

  /**
   * Mensajes de pacientes de las últimas 24 h que llevan más de 60 s sin
   * respuesta del agente, en conversaciones que el agente debería atender
   * (sin derivar a una persona y con el agente sin pausar).
   */
  private async mensajesSinRespuesta() {
    const filas = await this.prisma.$queryRaw<
      { clinic_id: string; clinic_name: string; conversation_id: string; sent_at: Date }[]
    >`
      SELECT m.clinic_id, cl.name AS clinic_name, m.conversation_id, m.sent_at
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN clinics cl ON cl.id = m.clinic_id
      LEFT JOIN agent_configs ac ON ac.clinic_id = m.clinic_id
      WHERE m.role = 'USER'
        AND m.sent_at >= now() - interval '24 hours'
        AND m.sent_at < now() - make_interval(secs => ${SLA.unansweredAfterSec})
        AND c.channel <> 'SIMULATOR'
        AND c.status <> 'HUMAN_TAKEOVER'
        AND COALESCE(ac.mode::text, 'AUTONOMOUS') <> 'PAUSED'
        AND cl.active IS NOT FALSE
        AND NOT EXISTS (
          SELECT 1 FROM messages r
          WHERE r.conversation_id = m.conversation_id
            AND r.role IN ('ASSISTANT', 'SYSTEM')
            AND r.sent_at >= m.sent_at
        )
      ORDER BY m.sent_at ASC
      LIMIT 20
    `;
    return {
      count: filas.length,
      items: filas.map((f) => ({
        clinic_id: f.clinic_id,
        clinic_name: f.clinic_name,
        conversation_id: f.conversation_id,
        waiting_sec: Math.round((Date.now() - new Date(f.sent_at).getTime()) / 1000),
      })),
    };
  }

  /** Estado de la cola BullMQ, preguntado al servicio del agente por la red interna. */
  private async cola() {
    const base = process.env.AGENT_SERVICE_URL || 'http://localhost:3003';
    try {
      const res = await fetch(`${base}/api/agent/internal/queue`, {
        headers: { 'x-platform-admin': 'true' },
        signal: AbortSignal.timeout(3000),
      });
      const cuerpo: any = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { available: true, ...(cuerpo?.data ?? cuerpo) };
    } catch (e) {
      this.logger.warn(`No se pudo consultar la cola: ${(e as Error).message}`);
      return { available: false, error: (e as Error).message };
    }
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
