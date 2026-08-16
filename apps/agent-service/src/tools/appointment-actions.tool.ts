import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';

@Injectable()
export class AppointmentActionsTool {
  private readonly logger = new Logger(AppointmentActionsTool.name);

  constructor(private readonly prisma: PrismaService) {}

  async searchActiveAppointments(clinicId: string, contactId: string) {
    this.logger.log(`Buscando citas activas para el contacto ${contactId} en clínica ${clinicId}`);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        contactId,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
        scheduledAt: { gte: new Date() },
      },
      include: {
        treatment: true,
        doctor: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return appointments;
  }

  async cancelAppointment(clinicId: string, appointmentId: string, reason?: string) {
    this.logger.log(`Cancelando cita ${appointmentId} en clínica ${clinicId}`);

    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
    });

    if (!appointment) {
      throw new Error(`La cita con ID ${appointmentId} no existe en esta clínica.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'CANCELLED',
          notes: reason || appointment.notes,
        },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          event: 'status_changed_cancelled',
          payload: { reason, updatedBy: 'AGENT' },
        },
      });

      return updated;
    });
  }

  async rescheduleAppointment(
    clinicId: string,
    appointmentId: string,
    newDate: Date,
    reason?: string
  ) {
    this.logger.log(
      `Reprogramando cita ${appointmentId} para la fecha ${newDate.toISOString()} en clínica ${clinicId}`
    );

    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
    });

    if (!appointment) {
      return { success: false, message: `La cita con ID ${appointmentId} no existe en esta clínica.` };
    }

    // Comprobar solapamiento de horarios para el mismo doctor
    const overlap = await this.prisma.appointment.findFirst({
      where: {
        clinicId,
        doctorId: appointment.doctorId,
        status: { not: 'CANCELLED' },
        scheduledAt: newDate,
        id: { not: appointmentId },
      },
    });

    if (overlap) {
      return {
        success: false,
        message: 'El nuevo horario ya se encuentra reservado para este especialista.',
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          scheduledAt: newDate,
          status: 'RESCHEDULED',
          notes: reason || appointment.notes,
        },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          event: 'rescheduled',
          payload: {
            old_date: appointment.scheduledAt,
            new_date: newDate,
            reason,
          },
        },
      });

      return res;
    });

    return { success: true, appointment: updated };
  }
}
