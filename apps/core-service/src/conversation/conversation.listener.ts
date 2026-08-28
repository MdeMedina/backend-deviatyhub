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

  async onModuleInit() {
    this.logger.log('Registrando listeners Redis de conversaciones...');

    const emitAction = (action: string) => (payload: any) => {
      const conversationId = payload?.conversationId;
      const appointmentId = payload?.appointmentId;
      this.gateway.emitEvent('conversation.action_executed', {
        conversation_id: conversationId,
        action,
        appointment_id: appointmentId,
      });
    };

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

      this.gateway.emitEvent('conversation.status_changed', {
        conversation_id: conversationId,
        status: 'HUMAN_TAKEOVER',
        assigned_user_id: null,
      });
    });

    this.logger.log('Listeners de conversaciones registrados.');
  }
}
