import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { REDIS_CHANNELS, EventBus } from '@deviaty/shared-events';
import { PrismaService } from '@deviaty/shared-prisma';
import { ConversationGateway } from './conversation.gateway';

/**
 * Suscribe el Core a los eventos Redis que publica el Agent Service y los
 * refleja en el panel vía Socket.io. Sin esto, las acciones del agente
 * (agendar/reprogramar/cancelar/escalar) no llegan al operador en tiempo real.
 */
@Injectable()
export class ConversationListener implements OnModuleInit {
  private readonly logger = new Logger(ConversationListener.name);

  constructor(
    @Inject(EventBus)
    private readonly eventBus: EventBus,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConversationGateway)
    private readonly gateway: ConversationGateway,
  ) {}

  /**
   * Clínica a la que pertenece un evento, para emitirlo solo en su sala. Se
   * saca de la base (la conversación o la cita) y no del payload: lo que diga
   * el evento no decide quién lo recibe. El clinicId del payload queda como
   * último recurso.
   */
  private async clinicaDelEvento(payload: any): Promise<string | null> {
    const conversationId = payload?.conversationId;
    if (conversationId) {
      const conv = await this.prisma.conversation
        .findUnique({ where: { id: conversationId }, select: { clinicId: true } })
        .catch(() => null);
      if (conv) return conv.clinicId;
    }
    const appointmentId = payload?.appointmentId;
    if (appointmentId) {
      const cita = await this.prisma.appointment
        .findUnique({ where: { id: appointmentId }, select: { clinicId: true } })
        .catch(() => null);
      if (cita) return cita.clinicId;
    }
    return typeof payload?.clinicId === 'string' ? payload.clinicId : null;
  }

  async onModuleInit() {
    this.logger.log('Registrando listeners Redis de conversaciones...');

    const emitAction = (action: string) => async (payload: any) => {
      const conversationId = payload?.conversationId;
      const appointmentId = payload?.appointmentId;
      const clinicId = await this.clinicaDelEvento(payload);
      this.gateway.emitToClinic(clinicId, 'conversation.action_executed', {
        conversation_id: conversationId,
        action,
        appointment_id: appointmentId,
      });
    };

    // Mensajes nuevos: lo que escribe el agent-service no pasa por el Core, así
    // que sin este puente el panel solo se actualizaba al recargar.
    await this.eventBus.subscribe(REDIS_CHANNELS.CONVERSATION_MESSAGE, async (payload: any) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      const clinicId = await this.clinicaDelEvento(payload);
      this.gateway.emitToClinic(clinicId, 'conversation.message', {
        conversation_id: conversationId,
        message: payload?.message ?? null,
      });
    });

    await this.eventBus.subscribe(REDIS_CHANNELS.APPOINTMENT_SCHEDULED, emitAction('appointment_scheduled'));
    await this.eventBus.subscribe(REDIS_CHANNELS.APPOINTMENT_RESCHEDULED, emitAction('appointment_rescheduled'));
    await this.eventBus.subscribe(REDIS_CHANNELS.APPOINTMENT_CANCELLED, emitAction('appointment_cancelled'));

    await this.eventBus.subscribe(REDIS_CHANNELS.HUMAN_ESCALATION, async (payload: any) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;

      try {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { status: 'HUMAN_TAKEOVER' },
        });
      } catch (e) {
        this.logger.warn(
          `No se pudo marcar HUMAN_TAKEOVER en ${conversationId}: ${(e as Error).message}`,
        );
      }

      const clinicId = await this.clinicaDelEvento(payload);
      this.gateway.emitToClinic(clinicId, 'conversation.status_changed', {
        conversation_id: conversationId,
        status: 'HUMAN_TAKEOVER',
        assigned_user_id: null,
      });
    });

    this.logger.log('Listeners de conversaciones registrados.');
  }
}
