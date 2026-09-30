import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { generarCodigoCita } from '@deviaty/shared-utils';
import { EventBus, REDIS_CHANNELS } from '@deviaty/shared-events';

@Injectable()
export class AppointmentActionsTool {
  private readonly logger = new Logger(AppointmentActionsTool.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EventBus)
    private readonly eventBus: EventBus,
  ) {}

  async searchActiveAppointments(clinicId: string, contactId: string) {
    this.logger.log(`Buscando citas activas para el contacto ${contactId} en clínica ${clinicId}`);

    // Paridad con "Buscar_citas_activas_por_chat" de n8n: solo citas vigentes y futuras, máx. 5.
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        contactId,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        scheduledAt: { gte: new Date() },
      },
      include: {
        treatment: true,
        doctor: true,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });

    return appointments;
  }

  /**
   * Agenda una nueva cita (equivalente al Flujo 2 de n8n a nivel de BDD).
   * Solo debe invocarse cuando la máquina de estados llega a `listo_para_ejecucion`.
   */
  /**
   * Referencia corta y libre. El índice es único, así que una colisión no
   * corrompe nada: reventaría la reserva. Con 28^6 combinaciones es improbable,
   * pero unos pocos intentos cuestan nada y evitan perder una cita por azar.
   */
  private async codigoLibre(tx: any): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const candidato = generarCodigoCita();
      const existe = await tx.appointment.findFirst({ where: { code: candidato }, select: { id: true } });
      if (!existe) return candidato;
    }
    // Agotados los intentos, mejor una cita sin referencia que ninguna cita.
    return '';
  }

  async scheduleAppointment(
    clinicId: string,
    params: {
      conversationId: string;
      contactId?: string | null;
      treatmentId: string;
      doctorId: string;
      scheduledAt: Date;
      durationMin: number;
      contactName?: string | null;
      /** Respuesta a la pregunta del tratamiento, p. ej. la pieza en una endodoncia. */
      extraAnswer?: string | null;
      /**
       * Datos del paciente para su ficha. Se recogen durante la conversación y
       * hay que guardarlos aquí: viven en el estado temporal de la reserva, que
       * se vacía justo al completarla, así que sin esto el RUT y la dirección
       * se perderían después de habérselos pedido.
       */
      paciente?: {
        nombre?: string | null;
        apellido?: string | null;
        rut?: string | null;
        direccion?: string | null;
        correo?: string | null;
      };
    },
  ): Promise<{ success: boolean; message?: string; appointment?: any }> {
    this.logger.log(
      `Agendando cita en clínica ${clinicId} para ${params.scheduledAt.toISOString()} (doctor ${params.doctorId})`,
    );

    // Evitar doble reserva del mismo especialista en el mismo horario
    const overlap = await this.prisma.appointment.findFirst({
      where: {
        clinicId,
        doctorId: params.doctorId,
        status: { not: 'CANCELLED' },
        scheduledAt: params.scheduledAt,
      },
    });
    if (overlap) {
      return { success: false, message: 'El horario ya se encuentra reservado para este especialista.' };
    }

    const appointment = await this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.create({
        data: {
          clinicId,
          contactId: params.contactId ?? null,
          treatmentId: params.treatmentId,
          doctorId: params.doctorId,
          conversationId: params.conversationId,
          contactName: params.contactName ?? null,
          scheduledAt: params.scheduledAt,
          durationMin: params.durationMin,
          status: 'CONFIRMED',
          source: 'AGENT',
          code: await this.codigoLibre(tx),
          extraAnswer: params.extraAnswer ?? null,
        },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId: appt.id,
          event: 'created',
          payload: { by: 'agent', at: new Date().toISOString() },
        },
      });

      // Ficha del paciente, en la misma transacción que la cita: o quedan las
      // dos cosas o ninguna. Solo se escribe lo que llegó con valor, para no
      // borrar con vacíos lo que ya hubiera de una visita anterior.
      const p = params.paciente;
      if (params.contactId && p) {
        const datos: Record<string, string> = {};
        if (p.nombre) datos.name = p.nombre;
        if (p.apellido) datos.lastName = p.apellido;
        if (p.rut) datos.rut = p.rut;
        if (p.direccion) datos.address = p.direccion;
        if (p.correo) datos.email = p.correo;

        if (Object.keys(datos).length) {
          await tx.clinicContact.update({ where: { id: params.contactId }, data: datos });
        }
      }

      return appt;
    });

    await this.eventBus.publish(REDIS_CHANNELS.APPOINTMENT_SCHEDULED, {
      // Lo pidió el paciente por WhatsApp y el agente ya se lo confirma en el
      // chat: notification-service no debe mandarle un segundo aviso.
      origen: 'AGENT',
      appointmentId: appointment.id,
      clinicId,
      conversationId: params.conversationId,
    });

    return { success: true, appointment };
  }

  async cancelAppointment(
    clinicId: string,
    appointmentId: string,
    reason?: string,
    conversationId?: string,
  ) {
    this.logger.log(`Cancelando cita ${appointmentId} en clínica ${clinicId}`);

    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
    });

    if (!appointment) {
      throw new Error(`La cita con ID ${appointmentId} no existe en esta clínica.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'CANCELLED',
          notes: reason || appointment.notes,
        },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          event: 'cancelled',
          payload: { reason, by: 'agent' },
        },
      });

      return res;
    });

    await this.eventBus.publish(REDIS_CHANNELS.APPOINTMENT_CANCELLED, {
      // Lo pidió el paciente por WhatsApp y el agente ya se lo confirma en el
      // chat: notification-service no debe mandarle un segundo aviso.
      origen: 'AGENT',
      appointmentId,
      clinicId,
      conversationId: conversationId ?? appointment.conversationId ?? undefined,
    });

    return updated;
  }

  async rescheduleAppointment(
    clinicId: string,
    appointmentId: string,
    newDate: Date,
    reason?: string,
    conversationId?: string,
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
            by: 'agent',
          },
        },
      });

      return res;
    });

    await this.eventBus.publish(REDIS_CHANNELS.APPOINTMENT_RESCHEDULED, {
      // Lo pidió el paciente por WhatsApp y el agente ya se lo confirma en el
      // chat: notification-service no debe mandarle un segundo aviso.
      origen: 'AGENT',
      appointmentId,
      clinicId,
      conversationId: conversationId ?? appointment.conversationId ?? undefined,
    });

    return { success: true, appointment: updated };
  }
}
