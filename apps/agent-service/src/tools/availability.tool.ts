import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { addMinutes, format, startOfDay, endOfDay } from 'date-fns';

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

    // 3. Obtener horario de la clínica para ese día
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

    // 4. Obtener bloqueos de no disponibilidad globales de la clínica
    const blocks = await this.prisma.unavailabilityBlock.findMany({
      where: {
        clinicId,
        active: true,
        daysOfWeek: { has: dayOfWeek },
      },
    });

    // 5. Obtener citas existentes para los doctores candidatos en este día
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

    // 6. Generar Slots y comprobar solapes
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

      // A. Comprobar si el slot cae dentro de algún bloqueo global
      const isBlocked = blocks.some((block) => {
        const [bStartH, bStartM] = block.startTime.split(':').map(Number);
        const [bEndH, bEndM] = block.endTime.split(':').map(Number);

        const bStart = new Date(date);
        bStart.setHours(bStartH, bStartM, 0, 0);
        const bEnd = new Date(date);
        bEnd.setHours(bEndH, bEndM, 0, 0);

        return slotStart < bEnd && slotEnd > bStart;
      });

      if (isBlocked) {
        current.setTime(current.getTime() + durationMin * 60 * 1000);
        continue;
      }

      // B. Comprobar disponibilidad de doctores: al menos uno debe estar libre
      const anyDoctorFree = doctorIds.some((docId) => {
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

    return slots; // Retornar todas las opciones disponibles
  }
}
