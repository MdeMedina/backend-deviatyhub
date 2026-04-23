import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { addMinutes, format, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class AvailabilityTool {
  private readonly logger = new Logger(AvailabilityTool.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAvailableSlots(clinicId: string, date: Date, durationMin = 30) {
    this.logger.log(`Consultando disponibilidad para clínica ${clinicId} en fecha ${format(date, 'yyyy-MM-dd')}`);

    // 1. Obtener horario de la clínica para ese día
    const dayOfWeek = date.getDay(); // 0 (Sun) - 6 (Sat)
    const schedule = await this.prisma.clinicSchedule.findFirst({
      where: { clinicId, dayOfWeek },
    });

    if (!schedule || !schedule.isOpen) return [];

    // 2. Obtener citas existentes
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        scheduledAt: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        status: { not: 'CANCELLED' },
      },
    });

    // 3. Generar Slots (Algoritmo simplificado)
    const slots: string[] = [];
    let current = new Date(date);
    // Asumimos hora de inicio del schedule
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    
    current.setHours(startH, startM, 0, 0);
    const end = new Date(date);
    end.setHours(endH, endM, 0, 0);

    while (current < end) {
      const isBusy = existingAppointments.some(app => {
        const appStart = new Date(app.scheduledAt);
        const appEnd = addMinutes(appStart, 30); // Duración fija por ahora
        return current >= appStart && current < appEnd;
      });

      if (!isBusy) {
        slots.push(format(current, 'HH:mm'));
      }
      current = addMinutes(current, durationMin);
    }

    return slots.slice(0, 5); // Retornar top 5 opciones
  }
}
