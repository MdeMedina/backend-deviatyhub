import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { REDIS_CHANNELS, EventBus } from '@deviaty/shared-events';
import { PrismaService } from '@deviaty/shared-prisma';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { enviarYRegistrar } from '../outbound.util';

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
      // auth-service publica el token como `inviteToken`; se leía `token` y el
      // enlace del correo salía como set-password?token=undefined.
      const { email, name, clinicId } = payload;
      const token = payload.token ?? payload.inviteToken;
      
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

    // ─── Avisos al equipo de la clínica ─────────────────────────────────
    //
    // Una derivación solo se veía si alguien tenía abierta la pantalla de
    // Conversaciones: el paciente quedaba esperando a alguien que no sabía que
    // tenía que contestar. Ahora llega también por correo.
    this.eventBus.subscribe(REDIS_CHANNELS.HUMAN_ESCALATION, async (payload: any) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      const conv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { clinicId: true, contact: { select: { name: true, lastName: true } } },
      });
      if (!conv) return;
      const { destinatarios, clinica } = await this.equipoDe(conv.clinicId);
      const paciente = [conv.contact?.name, conv.contact?.lastName].filter(Boolean).join(' ') || 'Un paciente';
      await this.emailService.sendTeamAlert(
        destinatarios,
        `Conversación derivada: ${paciente} espera respuesta`,
        [
          `${paciente} necesita que alguien del equipo de ${clinica} le responda por WhatsApp. El agente dejó de contestar en esa conversación.`,
          `Motivo: ${String(payload?.reason || 'sin detalle')}`,
          'Cuando termines, libera la conversación para que el agente vuelva a atenderla.',
        ],
        { url: `${this.config.get('FRONTEND_URL', 'https://app.dentral.cl')}/conversations?id=${conversationId}`, texto: 'Abrir la conversación' },
      );
    });

    // Clínicas con Dentalink: cada cita agendada, movida o anulada desde Dentral
    // hay que repetirla allí. Además del listado en la agenda, un correo al momento.
    const avisarCoordinacion = (canal: string) =>
      this.eventBus.subscribe(canal, async (payload: any) => {
        const cita: any = await this.prisma.appointment.findUnique({
          where: { id: payload?.appointmentId },
          include: { contact: true, doctor: true, treatment: true },
        });
        if (!cita || cita.coordination !== 'pendiente') return;
        const { destinatarios } = await this.equipoDe(cita.clinicId);
        const accion = cita.coordinationAction === 'anular' ? 'Anular' : cita.coordinationAction === 'mover' ? 'Mover' : 'Agendar';
        const paciente = [cita.contact?.name, cita.contact?.lastName].filter(Boolean).join(' ') || cita.contactName || 'Paciente';
        await this.emailService.sendTeamAlert(
          destinatarios,
          `${accion} en Dentalink: ${paciente}, ${format(cita.scheduledAt, "EEE d MMM HH:mm", { locale: es })}`,
          [
            `${accion} en Dentalink esta cita, que se ${cita.coordinationAction === 'anular' ? 'anuló' : cita.coordinationAction === 'mover' ? 'movió' : 'agendó'} desde Dentral${cita.source === 'AGENT' ? ' (por el agente, en el chat)' : ''}:`,
            `${format(cita.scheduledAt, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })} · ${cita.durationMin} min`,
            `Paciente: ${paciente}${cita.contact?.rut ? ` · RUT ${cita.contact.rut}` : ''}${cita.contact?.phone ? ` · +${String(cita.contact.phone).replace(/^\+/, '')}` : ''}`,
            `Profesional: ${cita.doctor?.name ?? '—'} · ${cita.treatment?.name ?? '—'}`,
            'Cuando esté hecho, márcalo en la agenda de Dentral («Por pasar a Dentalink»). La sincronización lo comprueba igual.',
          ],
          { url: `${this.config.get('FRONTEND_URL', 'https://app.dentral.cl')}/agenda`, texto: 'Abrir la agenda' },
        );
      });
    avisarCoordinacion(REDIS_CHANNELS.APPOINTMENT_SCHEDULED);
    avisarCoordinacion(REDIS_CHANNELS.APPOINTMENT_RESCHEDULED);
    avisarCoordinacion(REDIS_CHANNELS.APPOINTMENT_CANCELLED);

    // ─── Cancelación y cambio de hora hechos desde el panel ────────────────
    //
    // Antes no se avisaba a nadie: la cita desaparecía de la agenda y el
    // paciente seguía creyendo que tenía hora reservada. Se avisa por WhatsApp
    // porque es el canal por el que llegó, y también por correo si lo tenemos.
    //
    // Solo cuando el cambio viene del panel: si lo hizo el agente es porque el
    // paciente se lo pidió por chat y ya se lo confirmó allí.
    const avisarCambio = (canal: string, construir: (cita: any, payload: any) => string) =>
      this.eventBus.subscribe(canal, async (payload: any) => {
        const { appointmentId, clinicId, origen } = payload || {};
        if (origen !== 'PANEL') {
          this.logger.log(`${canal} de origen ${origen || 'desconocido'}: no se avisa al paciente.`);
          return;
        }

        const cita = await this.prisma.appointment.findUnique({
          where: { id: appointmentId },
          include: { contact: true, clinic: true, doctor: true, treatment: true },
        });
        if (!cita) {
          this.logger.warn(`${canal}: cita ${appointmentId} no encontrada.`);
          return;
        }

        const texto = construir(cita, payload);
        const telefono = (cita.contact as any)?.phone;

        if (telefono) {
          await enviarYRegistrar(this.prisma, this.eventBus, this.logger, {
            recipient: telefono,
            content: texto,
            conversationId: (cita as any).conversationId ?? null,
            clinicId,
          });
          this.logger.log(`Aviso de ${canal} enviado por WhatsApp (tel. …${String(telefono).slice(-4)}).`);
        } else {
          this.logger.warn(`${canal}: la cita ${appointmentId} no tiene teléfono de contacto.`);
        }
      });

    const cuando = (fecha: Date) =>
      `${format(fecha, "eeee d 'de' MMMM", { locale: es })} a las ${format(fecha, 'HH:mm')}`;

    await avisarCambio(REDIS_CHANNELS.APPOINTMENT_CANCELLED, (cita, payload) => {
      const motivo = payload?.motivo ? `\n\nMotivo: ${payload.motivo}` : '';
      return (
        `Hola${cita.contact?.name ? ` ${cita.contact.name}` : ''}, te escribimos de ` +
        `*${cita.clinic.name}*.\n\n` +
        `Tu hora de *${cita.treatment?.name ?? 'atención'}* del ` +
        `*${cuando(cita.scheduledAt)}* fue *cancelada*.${motivo}\n\n` +
        `Si quieres tomar otra hora, respóndenos por aquí y te ayudamos.`
      );
    });

    await avisarCambio(REDIS_CHANNELS.APPOINTMENT_RESCHEDULED, (cita, payload) => {
      const antes = payload?.fechaAnterior ? new Date(payload.fechaAnterior) : null;
      const cambio = antes ? `Tu hora del *${cuando(antes)}* se movió.\n\n` : '';
      return (
        `Hola${cita.contact?.name ? ` ${cita.contact.name}` : ''}, te escribimos de ` +
        `*${cita.clinic.name}*.\n\n${cambio}` +
        `Tu *${cita.treatment?.name ?? 'atención'}* queda para el ` +
        `*${cuando(cita.scheduledAt)}*` +
        `${cita.doctor?.name ? ` con *${cita.doctor.name}*` : ''}.\n\n` +
        `Si no te acomoda, respóndenos por aquí y la cambiamos.`
      );
    });

    this.logger.log('Listeners registrados exitosamente.');
  }

  /**
   * Quiénes reciben los avisos operativos: el personal activo de la clínica
   * que ya creó su contraseña. Los profesionales solo si no hay nadie más,
   * para no llenarles el correo de lo que gestiona recepción.
   */
  private async equipoDe(clinicId: string): Promise<{ destinatarios: string[]; clinica: string }> {
    const [usuarios, clinica] = await Promise.all([
      this.prisma.user.findMany({
        where: { clinicId, active: true, passwordHash: { not: null }, platformAdmin: false },
        select: { email: true, doctor: { select: { id: true } } },
      }),
      this.prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } }),
    ]);
    const personal = usuarios.filter((u) => !u.doctor).map((u) => u.email);
    return { destinatarios: personal.length ? personal : usuarios.map((u) => u.email), clinica: clinica?.name ?? 'la clínica' };
  }
}
