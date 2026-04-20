import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { REDIS_CHANNELS, EventBus } from '@deviaty/shared-events';
import { PrismaService } from '@deviaty/shared-prisma';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

@Injectable()
export class NotificationListener implements OnModuleInit {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    @Inject(EventBus)
    private readonly eventBus: EventBus,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService
  ) {}

  async onModuleInit() {
    this.logger.log('Inicializando Listeners de Notificaciones...');

    // 1. Escuchar invitaciones de usuarios
    this.eventBus.subscribe(REDIS_CHANNELS.USER_INVITED, async (payload: any) => {
      this.logger.log(`Evento recibido: ${REDIS_CHANNELS.USER_INVITED}`);
      const { email, name, clinicId, token } = payload;
      
      const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
      const clinicName = clinic?.name || 'Tu Clínica';
      
      const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
      const inviteLink = `${frontendUrl}/set-password?token=${token}`;

      await this.emailService.sendInvitation(email, name, clinicName, inviteLink);
    });

    // 2. Escuchar confirmaciones de citas
    this.eventBus.subscribe(REDIS_CHANNELS.APPOINTMENT_SCHEDULED, async (payload: any) => {
      this.logger.log(`Evento recibido: ${REDIS_CHANNELS.APPOINTMENT_SCHEDULED}`);
      const { appointmentId, clinicId } = payload;

      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          contact: true,
          clinic: true,
          doctor: true,
          treatment: true,
        },
      });

      if (!appointment || !(appointment.contact as any)?.email) {
        this.logger.warn(`Cita ${appointmentId} no encontrada o sin email de contacto.`);
        return;
      }

      const scheduledAt = appointment.scheduledAt;
      
      await this.emailService.sendAppointmentConfirmation((appointment.contact as any).email, {
        patientName: (appointment.contact as any).name || 'Paciente',
        clinicName: appointment.clinic.name,
        doctorName: appointment.doctor?.name || 'Especialista',
        treatmentName: appointment.treatment?.name || 'Tratamiento',
        date: format(scheduledAt, "eeee d 'de' MMMM", { locale: es }),
        time: format(scheduledAt, 'HH:mm'),
        location: (appointment.clinic as any).address, // Casting if address missing in type but present in DB
      });
    });

    this.logger.log('Listeners registrados exitosamente.');
  }
}
