import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { subDays } from 'date-fns';

/** Minutos de recepción que ahorra cada mensaje que contesta el agente (especificación). */
export const MINUTOS_POR_MENSAJE = 2.5;

/** Metas de la especificación, para que el panel diga si se cumplen. */
export const METAS = {
  roiMultiple: 3,
  noShowReduction: 0.25,
  conversion: 0.35,
  afterHoursShare: 0.3,
  frtP50Sec: 8,
  autonomy: 0.8,
  hoursSavedMonth: 20,
};

export type EstadoGarantia = 'SIN_TICKET' | 'EN_CURSO' | 'GUARANTEE_ACHIEVED' | 'GUARANTEE_TRIGGERED';

/**
 * La garantía: si en el mes las citas asistidas que agendó el agente no pagan
 * la mensualidad, el mes siguiente no se cobra.
 *
 *   umbral = ⌈ mensualidad (USD) × tipo de cambio / ticket promedio (moneda local) ⌉
 *
 * Mientras el mes no termina no está ni cumplida ni incumplida: está en curso.
 */
export function evaluarGarantia(p: {
  feeUsd: number;
  usdRate: number;
  avgTicket: number | null | undefined;
  attended: number;
  monthEnded: boolean;
}) {
  const ticketUsd = p.avgTicket && p.usdRate > 0 ? p.avgTicket / p.usdRate : null;
  const umbral = ticketUsd ? Math.max(1, Math.ceil(p.feeUsd / ticketUsd - 1e-9)) : null;
  let estado: EstadoGarantia;
  if (!umbral) estado = 'SIN_TICKET';
  else if (p.attended >= umbral) estado = 'GUARANTEE_ACHIEVED';
  else estado = p.monthEnded ? 'GUARANTEE_TRIGGERED' : 'EN_CURSO';

  return {
    monthlyFeeUsd: p.feeUsd,
    avgTicketUsd: ticketUsd != null ? Math.round(ticketUsd * 100) / 100 : null,
    thresholdAppointments: umbral,
    attributedAttended: p.attended,
    guaranteeMet: estado === 'GUARANTEE_ACHIEVED',
    status: estado,
    progress: umbral ? Math.round((p.attended / umbral) * 1000) / 10 : null,
    // Lo que se le factura el mes siguiente por este mes.
    nextInvoiceUsd: estado === 'GUARANTEE_TRIGGERED' ? 0 : p.feeUsd,
  };
}

function ratio(a: number, b: number): number | null {
  return b > 0 ? Math.round((a / b) * 1000) / 1000 : null;
}

/**
 * Métricas de impacto del agente para una clínica: lo que la especificación
 * llama "de cara al cliente". Todo sale de las tablas de origen, sin
 * simulador. Lo que necesita datos que la clínica todavía no cargó (ticket,
 * asistencia, línea base) devuelve null en vez de un número inventado.
 */
@Injectable()
export class ImpactService {
  private readonly tz = process.env.CLINIC_TIMEZONE || 'America/Santiago';

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async comercial(clinicId: string) {
    return this.prisma.clinicCommercial.findUnique({ where: { clinicId } });
  }

  async impacto(clinicId: string, dias: number) {
    const to = new Date();
    const from = subDays(to, dias);
    const com = await this.comercial(clinicId);

    const [asistencia, conversion, fueraDeHorario, frt, autonomia, mensajesAgente] = await Promise.all([
      this.asistencia(clinicId, from, to, com?.avgTicket ?? null),
      this.conversion(clinicId, from, to),
      this.citasFueraDeHorario(clinicId, from, to),
      this.tiempoDePrimeraRespuesta(clinicId, from, to),
      this.autonomia(clinicId, from, to),
      this.mensajesUtilesDelAgente(clinicId, from, to),
    ]);

    const horasAhorradas = Math.round(((mensajesAgente * MINUTOS_POR_MENSAJE) / 60) * 10) / 10;
    const noShow = ratio(asistencia.noShow, asistencia.attended + asistencia.noShow);

    return {
      period_days: dias,
      range: { from, to },
      currency: com?.currency ?? 'CLP',
      targets: METAS,
      business: {
        estimated_revenue: asistencia.revenue,
        attended_appointments: asistencia.attended,
        no_show_appointments: asistencia.noShow,
        unmarked_appointments: asistencia.unmarked,
        attendance_rate: ratio(asistencia.attended, asistencia.attended + asistencia.noShow),
        no_show_rate: noShow,
        baseline_no_show_rate: com?.noShowRate ?? null,
        no_show_reduction: noShow != null && com?.noShowRate ? Math.round((1 - noShow / com.noShowRate) * 1000) / 1000 : null,
        agent_appointments: fueraDeHorario.total,
        conversion_rate: ratio(conversion.convertidas, conversion.conIntencion),
        conversations_with_booking_intent: conversion.conIntencion,
        after_hours_appointments: fueraDeHorario.fuera,
        after_hours_share: ratio(fueraDeHorario.fuera, fueraDeHorario.total),
        first_response_p50_sec: frt.p50,
        baseline_first_response_sec: com?.firstResponseTimeSec ?? null,
        autonomy_rate: autonomia.tasa,
        conversations: autonomia.total,
        agent_messages: mensajesAgente,
        reception_hours_saved: horasAhorradas,
        reception_hours_saved_month: Math.round(((horasAhorradas * 30) / dias) * 10) / 10,
      },
    };
  }

  /** Garantía del mes en curso y del anterior (el que decide la próxima factura). */
  async garantia(clinicId: string) {
    const com = await this.comercial(clinicId);
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

    const [actual, anterior] = await Promise.all([
      this.asistidasDelAgente(clinicId, inicioMes, ahora),
      this.asistidasDelAgente(clinicId, inicioAnterior, inicioMes),
    ]);
    const base = { feeUsd: com?.monthlyFeeUsd ?? 99, usdRate: com?.usdRate ?? 950, avgTicket: com?.avgTicket };
    return {
      currency: com?.currency ?? 'CLP',
      avg_ticket: com?.avgTicket ?? null,
      usd_rate: com?.usdRate ?? 950,
      current_month: { from: inicioMes, ...evaluarGarantia({ ...base, attended: actual, monthEnded: false }) },
      previous_month: { from: inicioAnterior, ...evaluarGarantia({ ...base, attended: anterior, monthEnded: true }) },
    };
  }

  // ─── Cálculos ─────────────────────────────────────────────────────────

  /** Citas del agente cuya hora cayó en el periodo: asistidas, faltas, sin marcar e ingreso. */
  private async asistencia(clinicId: string, from: Date, to: Date, avgTicket: number | null) {
    const ahora = new Date();
    const citas = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        source: 'AGENT',
        conversationId: { not: null },
        scheduledAt: { gte: from, lt: to < ahora ? to : ahora },
        status: { not: 'CANCELLED' },
      },
      select: { status: true, treatment: { select: { price: true } } },
    });
    let attended = 0;
    let noShow = 0;
    let unmarked = 0;
    let revenue = 0;
    let sinValor = false;
    for (const c of citas) {
      if (c.status === 'COMPLETED') {
        attended += 1;
        // El precio del tratamiento cuando se conoce; si no, el ticket promedio.
        const valor = c.treatment?.price ?? avgTicket;
        if (valor == null) sinValor = true;
        else revenue += valor;
      } else if (c.status === 'NO_SHOW') noShow += 1;
      else unmarked += 1;
    }
    return { attended, noShow, unmarked, revenue: sinValor && revenue === 0 ? null : revenue };
  }

  private async asistidasDelAgente(clinicId: string, from: Date, to: Date) {
    return this.prisma.appointment.count({
      where: { clinicId, source: 'AGENT', conversationId: { not: null }, status: 'COMPLETED', scheduledAt: { gte: from, lt: to } },
    });
  }

  /** Conversaciones donde el paciente quiso agendar y cuántas terminaron con una hora del agente. */
  private async conversion(clinicId: string, from: Date, to: Date) {
    const filas = await this.prisma.$queryRaw<{ con_intencion: bigint; convertidas: bigint }[]>`
      WITH intencion AS (
        SELECT DISTINCT m.conversation_id
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE m.clinic_id = ${clinicId}::uuid
          AND m.role = 'USER'
          AND m.sent_at >= ${from} AND m.sent_at < ${to}
          AND c.channel <> 'SIMULATOR'
          AND m.langchain_meta->>'intent' = 'agendar_cita'
      )
      SELECT
        (SELECT COUNT(*) FROM intencion) AS con_intencion,
        (SELECT COUNT(DISTINCT a.conversation_id) FROM appointments a
          WHERE a.conversation_id IN (SELECT conversation_id FROM intencion)
            AND a.source = 'AGENT'
            AND a.created_at >= ${from} AND a.created_at < ${to}) AS convertidas
    `;
    return { conIntencion: Number(filas?.[0]?.con_intencion ?? 0), convertidas: Number(filas?.[0]?.convertidas ?? 0) };
  }

  /** Horas que agendó el agente con la clínica cerrada, según su horario. */
  private async citasFueraDeHorario(clinicId: string, from: Date, to: Date) {
    const filas = await this.prisma.$queryRaw<{ total: bigint; fuera: bigint }[]>`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE
               s.id IS NULL
               OR s.is_open = false
               OR to_char(a.created_at AT TIME ZONE ${this.tz}, 'HH24:MI') < s.open_time
               OR to_char(a.created_at AT TIME ZONE ${this.tz}, 'HH24:MI') >= s.close_time
             ) AS fuera
      FROM appointments a
      LEFT JOIN clinic_schedules s
        ON s.clinic_id = a.clinic_id
       AND s.day_of_week = EXTRACT(DOW FROM (a.created_at AT TIME ZONE ${this.tz}))
      WHERE a.clinic_id = ${clinicId}::uuid
        AND a.source = 'AGENT'
        AND a.conversation_id IS NOT NULL
        AND a.created_at >= ${from} AND a.created_at < ${to}
    `;
    return { total: Number(filas?.[0]?.total ?? 0), fuera: Number(filas?.[0]?.fuera ?? 0) };
  }

  /** Mediana del tiempo entre un mensaje del paciente y la respuesta del agente. */
  private async tiempoDePrimeraRespuesta(clinicId: string, from: Date, to: Date) {
    const filas = await this.prisma.$queryRaw<{ p50: number | null }[]>`
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t.sent_at - t.prev_user_at)))::float AS p50
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
        AND t.sent_at - t.prev_user_at < interval '1 hour'
    `;
    const p50 = filas?.[0]?.p50;
    return { p50: p50 == null ? null : Math.round(p50 * 10) / 10 };
  }

  /**
   * Respuestas del agente que ahorraron trabajo a recepción. Se excluyen las
   * conversaciones con otro bot, no con pacientes: las que cortó el
   * corta-bucles y las que superaron su umbral (40 respuestas en una hora)
   * antes de que existiera. Una sola, el 29/09, sumó 864 respuestas, que
   * contadas como "horas ahorradas" daban 36 horas falsas.
   */
  private async mensajesUtilesDelAgente(clinicId: string, from: Date, to: Date) {
    const filas = await this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.clinic_id = ${clinicId}::uuid
        AND m.role = 'ASSISTANT'
        AND m.sent_at >= ${from} AND m.sent_at < ${to}
        AND c.channel <> 'SIMULATOR'
        AND NOT EXISTS (
          SELECT 1 FROM messages s
          WHERE s.conversation_id = m.conversation_id
            AND s.role = 'SYSTEM'
            AND s.content LIKE 'El agente dejó de responder automáticamente%'
        )
        AND m.conversation_id NOT IN (
          SELECT b.conversation_id FROM messages b
          WHERE b.clinic_id = ${clinicId}::uuid AND b.role = 'ASSISTANT'
          GROUP BY b.conversation_id, date_trunc('hour', b.sent_at)
          HAVING COUNT(*) > 40
        )
    `;
    return Number(filas?.[0]?.n ?? 0);
  }

  /** Conversaciones del periodo resueltas sin que interviniera una persona. */
  private async autonomia(clinicId: string, from: Date, to: Date) {
    const base = { clinicId, startedAt: { gte: from, lt: to }, channel: { not: 'SIMULATOR' } };
    const [total, derivadas] = await Promise.all([
      this.prisma.conversation.count({ where: base }),
      this.prisma.conversation.count({
        where: { ...base, OR: [{ status: 'HUMAN_TAKEOVER' }, { assignedUserId: { not: null } }] },
      }),
    ]);
    return { total, tasa: ratio(total - derivadas, total) };
  }
}
