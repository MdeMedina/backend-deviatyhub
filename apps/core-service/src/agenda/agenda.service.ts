import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { calcularHorasLibres } from '@deviaty/shared-utils';

@Injectable()
export class AgendaService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  /**
   * Las horas que se muestran en la agenda son las mismas que el agente ofrece
   * por WhatsApp: mismo cálculo, en shared-utils. Antes había aquí una versión
   * propia que ni siquiera comprobaba qué profesional atiende cada tratamiento,
   * así que el panel y el agente podían contradecirse.
   */
  async getAvailableSlots(
    clinicId: string,
    date: string,
    treatmentId?: string,
    doctorId?: string
  ) {
    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(year, (month || 1) - 1, day || 1);

    const horas = await calcularHorasLibres(
      this.prisma,
      clinicId,
      targetDate,
      treatmentId,
      doctorId,
    );

    // Mismo criterio que para el agente, incluidas las horas ya pasadas del día
    // en curso: si no se le puede ofrecer a un paciente, tampoco es un hueco
    // libre en pantalla.
    return horas.map((time) => ({ time, available: true }));
  }

  // --- APPOINTMENTS ---

  /**
   * Si el usuario conectado es un profesional, su agenda es la suya y solo la
   * suya. Se resuelve en el servidor a propósito: el filtro por doctor que
   * viaja en la query lo controla el cliente, así que basta con no enviarlo
   * para ver las citas de toda la clínica, con los nombres de los pacientes
   * de los demás.
   */
  private async doctorDelUsuario(clinicId: string, userId?: string): Promise<string | null> {
    if (!userId) return null;
    const ficha = await this.prisma.doctor.findFirst({
      where: { clinicId, userId },
      select: { id: true },
    });
    return ficha?.id ?? null;
  }

  async findAllAppointments(
    clinicId: string,
    from: string,
    to: string,
    doctorId?: string,
    userId?: string,
  ) {
    const propio = await this.doctorDelUsuario(clinicId, userId);
    const filtroDoctor = propio ?? doctorId;

    return this.prisma.appointment.findMany({
      where: {
        clinicId,
        scheduledAt: {
          gte: new Date(`${from}T00:00:00Z`),
          lte: new Date(`${to}T23:59:59Z`),
        },
        ...(filtroDoctor ? { doctorId: filtroDoctor } : {}),
      },
      include: {
        contact: true,
        treatment: true,
        doctor: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOneAppointment(clinicId: string, id: string, userId?: string) {
    const propio = await this.doctorDelUsuario(clinicId, userId);
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, clinicId, ...(propio ? { doctorId: propio } : {}) },
      include: {
        contact: true,
        treatment: true,
        doctor: true,
        history: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!appointment) throw new NotFoundException('Cita no encontrada');
    return appointment;
  }

  async createAppointment(clinicId: string, dto: any) {
    const { contact_id, contact_name, contact_phone, treatment_id, doctor_id, scheduled_at, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1. Resolver contacto
      let finalContactId = contact_id;
      if (!finalContactId && contact_phone) {
        let contact = await tx.clinicContact.findFirst({
          where: { clinicId, phone: contact_phone },
        });
        if (!contact) {
          contact = await tx.clinicContact.create({
            data: { clinicId, phone: contact_phone, name: contact_name },
          });
        }
        finalContactId = contact.id;
      }

      // 2. Obtener duración del tratamiento
      const treatment = await tx.treatment.findUnique({ where: { id: treatment_id } });
      if (!treatment) throw new NotFoundException('Tratamiento no encontrado');

      // 3. Validar disponibilidad (Simplificado: Check if any appointment overlaps at same time/doctor)
      // En prod, esto debería usar la lógica de getAvailableSlots completa
      const overlap = await tx.appointment.findFirst({
        where: {
          clinicId,
          doctorId: doctor_id,
          status: { notIn: ['CANCELLED'] },
          scheduledAt: scheduled_at,
        },
      });

      if (overlap) throw new BadRequestException('El horario ya está ocupado');

      // 4. Crear cita
      const appointment = await tx.appointment.create({
        data: {
          clinicId,
          contactId: finalContactId,
          treatmentId: treatment_id,
          doctorId: doctor_id,
          scheduledAt: scheduled_at,
          durationMin: treatment.durationAvgMin || 30,
          contactName: contact_name,
          ...rest,
        },
      });

      // 5. Registrar historia
      await tx.appointmentHistory.create({
        data: {
          appointmentId: appointment.id,
          event: 'created',
          payload: { source: rest.source || 'AGENT' },
        },
      });

      return appointment;
    });
  }

  async updateStatus(clinicId: string, id: string, status: string, notes?: string) {
    const appointment = await this.findOneAppointment(clinicId, id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: { status: status as any, notes: notes || appointment.notes },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId: id,
          event: `status_changed_${status.toLowerCase()}`,
          payload: { notes },
        },
      });

      return updated;
    });
  }

  async reschedule(clinicId: string, id: string, newDate: Date, notes?: string) {
    const appointment = await this.findOneAppointment(clinicId, id);

    return this.prisma.$transaction(async (tx) => {
      // Validar disponibilidad en nueva fecha (mismo doctor)
      const overlap = await tx.appointment.findFirst({
        where: {
          clinicId,
          doctorId: appointment.doctorId,
          status: { notIn: ['CANCELLED'] },
          scheduledAt: newDate,
          id: { not: id },
        },
      });

      if (overlap) throw new BadRequestException('El nuevo horario ya está ocupado');

      const updated = await tx.appointment.update({
        where: { id },
        data: { 
            scheduledAt: newDate, 
            status: 'RESCHEDULED',
            notes: notes || appointment.notes
        },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId: id,
          event: 'rescheduled',
          payload: { 
              old_date: appointment.scheduledAt, 
              new_date: newDate,
              notes 
          },
        },
      });

      return updated;
    });
  }
}
