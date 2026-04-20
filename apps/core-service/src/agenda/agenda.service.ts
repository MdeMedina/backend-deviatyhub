import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { calculateSlots } from '@deviaty/shared-utils';
import { format, getDay, parseISO } from 'date-fns';

@Injectable()
export class AgendaService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getAvailableSlots(
    clinicId: string,
    date: string,
    treatmentId?: string,
    doctorId?: string
  ) {
    const targetDate = parseISO(date);
    const dayOfWeek = getDay(targetDate); // 0 (Dom) a 6 (Sab)

    // 1. Obtener horario de la clínica para ese día
    const schedule = await this.prisma.clinicSchedule.findFirst({
      where: { clinicId, dayOfWeek, isOpen: true },
    });

    if (!schedule) {
      return []; // Clínica cerrada
    }

    // 2. Obtener duración del tratamiento (o default 30 min)
    let duration = 30;
    if (treatmentId) {
      const treatment = await this.prisma.treatment.findUnique({
        where: { id: treatmentId },
      });
      if (treatment?.durationAvgMin) {
        duration = treatment.durationAvgMin;
      }
    }

    // 3. Generar slots base
    const baseSlots = calculateSlots(schedule.openTime, schedule.closeTime, duration);

    // 4. Obtener bloqueos de no disponibilidad globales
    const blocks = await this.prisma.unavailabilityBlock.findMany({
      where: {
        clinicId,
        active: true,
        daysOfWeek: { has: dayOfWeek },
      },
    });

    // 5. Obtener citas agendadas para ese día
    // Consideramos citas que intersecten con el horario de apertura
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        scheduledAt: {
          gte: new Date(`${date}T00:00:00Z`),
          lte: new Date(`${date}T23:59:59Z`),
        },
        status: { notIn: ['CANCELLED'] },
        ...(doctorId ? { doctorId } : {}),
      },
    });

    // 6. Filtrar slots
    return baseSlots.filter((slotTime) => {
      const [slotH, slotM] = slotTime.split(':').map(Number);
      
      // Filtrar por bloques de no disponibilidad
      const isBlocked = blocks.some((block) => {
        const [startH, startM] = block.startTime.split(':').map(Number);
        const [endH, endM] = block.endTime.split(':').map(Number);
        
        const slotVal = slotH * 60 + slotM;
        const startVal = startH * 60 + startM;
        const endVal = endH * 60 + endM;
        
        return slotVal >= startVal && slotVal < endVal;
      });

      if (isBlocked) return false;

      // Filtrar por citas agendadas
      const isBooked = appointments.some((app) => {
        const appTime = format(app.scheduledAt, 'HH:mm');
        const appDuration = app.durationMin;
        
        const slotVal = slotH * 60 + slotM;
        const [appH, appM] = appTime.split(':').map(Number);
        const appStartVal = appH * 60 + appM;
        const appEndVal = appStartVal + appDuration;
        
        // El slot colisiona si empieza dentro de una cita existente
        return slotVal >= appStartVal && slotVal < appEndVal;
      });

      if (isBooked) return false;

      return true;
    }).map(time => ({
        time,
        available: true
    }));
  }
}
