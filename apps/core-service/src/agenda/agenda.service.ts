import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
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

  // --- APPOINTMENTS ---

  async findAllAppointments(clinicId: string, from: string, to: string, doctorId?: string) {
    return this.prisma.appointment.findMany({
      where: {
        clinicId,
        scheduledAt: {
          gte: new Date(`${from}T00:00:00Z`),
          lte: new Date(`${to}T23:59:59Z`),
        },
        ...(doctorId ? { doctorId } : {}),
      },
      include: {
        contact: true,
        treatment: true,
        doctor: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOneAppointment(clinicId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, clinicId },
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
