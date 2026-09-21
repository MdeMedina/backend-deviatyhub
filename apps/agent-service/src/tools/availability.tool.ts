import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { addMinutes, format, startOfDay, endOfDay } from 'date-fns';

/** Tramo de minutos desde medianoche. */
interface Tramo {
  desde: number;
  hasta: number;
}

const aMinutos = (hhmm: string): number => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Intersección de dos listas de tramos. El resultado nunca amplía a ninguna. */
const intersectar = (a: Tramo[], b: Tramo[]): Tramo[] => {
  const out: Tramo[] = [];
  for (const x of a) {
    for (const y of b) {
      const desde = Math.max(x.desde, y.desde);
      const hasta = Math.min(x.hasta, y.hasta);
      if (desde < hasta) out.push({ desde, hasta });
    }
  }
  return out;
};

@Injectable()
export class AvailabilityTool {
  private readonly logger = new Logger(AvailabilityTool.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAvailableSlots(
    clinicId: string,
    date: Date,
    treatmentId?: string,
    doctorId?: string
  ): Promise<string[]> {
    this.logger.log(
      `Consultando disponibilidad para clínica ${clinicId} en fecha ${format(
        date,
        'yyyy-MM-dd'
      )} (Treatment: ${treatmentId || 'N/A'}, Doctor: ${doctorId || 'N/A'})`
    );

    // 1. Determinar duración de la cita
    let durationMin = 30;
    if (treatmentId) {
      const treatment = await this.prisma.treatment.findUnique({
        where: { id: treatmentId },
      });
      if (treatment?.durationAvgMin) {
        durationMin = treatment.durationAvgMin;
      }
    }

    // 2. Resolver lista de doctores candidatos activos
    let doctorIds: string[] = [];
    if (doctorId) {
      const doc = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
      });
      if (doc && doc.active !== false) {
        doctorIds = [doctorId];
      }
    } else if (treatmentId) {
      const docsTr = await this.prisma.doctorTreatment.findMany({
        where: { clinicId, treatmentId },
        include: { doctor: true },
      });
      doctorIds = docsTr
        .filter((dt) => dt.doctor && dt.doctor.active !== false)
        .map((dt) => dt.doctorId);
    } else {
      const activeDocs = await this.prisma.doctor.findMany({
        where: { clinicId, active: true },
      });
      doctorIds = activeDocs.map((d) => d.id);
    }

    if (doctorIds.length === 0) {
      this.logger.warn(`No se encontraron doctores activos para los criterios especificados.`);
      return [];
    }

    // 3. Horario de la clínica para ese día. Es el límite exterior: la jornada
    //    de un profesional puede recortar dentro de él, nunca ampliarlo.
    const dayOfWeek = date.getDay(); // 0 (Sun) - 6 (Sat)
    const scheduleDb = await this.prisma.clinicSchedule.findFirst({
      where: { clinicId, dayOfWeek },
    });

    const schedule = (scheduleDb || {
      isOpen: dayOfWeek !== 0,
      openTime: '09:00',
      closeTime: '18:00',
      clinicId,
      dayOfWeek,
    }) as { isOpen: boolean | null; openTime: string; closeTime: string };

    if (!schedule.isOpen) {
      return [];
    }

    const tramoClinica: Tramo[] = [
      { desde: aMinutos(schedule.openTime), hasta: aMinutos(schedule.closeTime) },
    ];

    // 4. Bloqueos globales de la clínica (recurrentes por día de la semana)
    const blocks = await this.prisma.unavailabilityBlock.findMany({
      where: {
        clinicId,
        active: true,
        daysOfWeek: { has: dayOfWeek },
      },
    });

    // 5. Jornada propia de cada profesional para ese día de la semana.
    const jornadas = await this.prisma.doctorSchedule.findMany({
      where: { clinicId, doctorId: { in: doctorIds }, dayOfWeek, active: true },
    });

    // 6. Ausencias con fecha que solapan con el día consultado.
    const ausencias = await this.prisma.doctorAbsence.findMany({
      where: {
        clinicId,
        doctorId: { in: doctorIds },
        startsAt: { lt: endOfDay(date) },
        endsAt: { gt: startOfDay(date) },
      },
    });

    // 7. Citas existentes de esos profesionales ese día.
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        doctorId: { in: doctorIds },
        scheduledAt: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        status: { not: 'CANCELLED' },
      },
    });

    // 8. Ventana efectiva de trabajo de cada profesional, ya acotada por la clínica.
    //    Sin jornada configurada se asume el horario completo de la clínica: así
    //    los profesionales dados de alta antes de existir esta función siguen
    //    comportándose igual que siempre en lugar de quedarse sin horas.
    const ventanaPorDoctor = new Map<string, Tramo[]>();
    for (const docId of doctorIds) {
      const propios = jornadas.filter((j) => j.doctorId === docId);
      const base: Tramo[] = propios.length
        ? propios.map((j) => ({ desde: aMinutos(j.startTime), hasta: aMinutos(j.endTime) }))
        : tramoClinica;
      ventanaPorDoctor.set(docId, intersectar(base, tramoClinica));
    }

    // 9. Generar slots y comprobar solapes
    const slots: string[] = [];
    const current = new Date(date);
    const [startH, startM] = schedule.openTime.split(':').map(Number);
    const [endH, endM] = schedule.closeTime.split(':').map(Number);

    current.setHours(startH, startM, 0, 0);
    const end = new Date(date);
    end.setHours(endH, endM, 0, 0);

    const now = new Date();
    const isToday = format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');

    while (current < end) {
      const slotStart = new Date(current);
      const slotEnd = addMinutes(slotStart, durationMin);
      const slotDesde = slotStart.getHours() * 60 + slotStart.getMinutes();
      const slotHasta = slotDesde + durationMin;

      // A. Bloqueo global de la clínica
      const isBlocked = blocks.some((block) => {
        const bStart = aMinutos(block.startTime);
        const bEnd = aMinutos(block.endTime);
        return slotDesde < bEnd && slotHasta > bStart;
      });

      if (isBlocked) {
        current.setTime(current.getTime() + durationMin * 60 * 1000);
        continue;
      }

      // B. Al menos un profesional debe poder atenderlo: dentro de SU jornada,
      //    sin ausencia registrada y sin otra cita encima.
      const anyDoctorFree = doctorIds.some((docId) => {
        const ventana = ventanaPorDoctor.get(docId) || [];
        const dentroDeSuJornada = ventana.some(
          (t) => slotDesde >= t.desde && slotHasta <= t.hasta,
        );
        if (!dentroDeSuJornada) return false;

        const ausente = ausencias.some(
          (a) =>
            a.doctorId === docId &&
            slotStart < new Date(a.endsAt) &&
            slotEnd > new Date(a.startsAt),
        );
        if (ausente) return false;

        const isBusy = existingAppointments.some((app) => {
          if (app.doctorId !== docId) return false;
          const appStart = new Date(app.scheduledAt);
          const appEnd = addMinutes(appStart, app.durationMin || 30);
          return slotStart < appEnd && slotEnd > appStart;
        });
        return !isBusy;
      });

      const isPast = isToday && slotStart <= now;

      if (anyDoctorFree && !isPast) {
        slots.push(format(slotStart, 'HH:mm'));
      }

      current.setTime(current.getTime() + durationMin * 60 * 1000);
    }

    return slots;
  }
}
