import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { EventBus } from '@deviaty/shared-events';
import { AppEvents } from '@deviaty/shared-types';

@Injectable()
export class HumanTool {
  private readonly logger = new Logger(HumanTool.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async escalate(conversationId: string, reason: string) {
    this.logger.log(`Escalando conversación ${conversationId} a humano.`);

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { clinicId: true, metadata: true },
    });
    const ahora = new Date();

    // 1. Estado y cuándo se derivó. La marca la usa el procesador: si la
    //    conversación pasó a una persona DURANTE este turno por decisión del
    //    agente, su mensaje ("le paso con el equipo") sí se envía; si la tomó
    //    alguien del equipo mientras el agente pensaba, no.
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'HUMAN_TAKEOVER',
        metadata: { ...((conv?.metadata as any) || {}), derivacion: { at: ahora.toISOString(), motivo: reason } },
      },
    });

    // 2. El motivo, en el hilo: el equipo veía la conversación derivada sin
    //    saber por qué. Como mensaje de sistema, no lo ve el paciente ni el modelo.
    if (conv?.clinicId) {
      const nota = await this.prisma.message
        .create({
          data: {
            conversationId,
            clinicId: conv.clinicId,
            role: 'SYSTEM',
            content: `Derivada al equipo: ${reason}`,
            sentAt: ahora,
          },
        })
        .catch(() => null);
      if (nota) {
        await this.eventBus.publish('conversation.message', { conversationId, message: nota }).catch(() => undefined);
      }
    }

    // 3. Aviso: panel en vivo (core-service) y correo al equipo (notification-service).
    await this.eventBus.publish(AppEvents.HUMAN_ESCALATION, {
      conversationId,
      clinicId: conv?.clinicId,
      reason,
      timestamp: ahora,
    });

    return 'Conectando con un asesor humano...';
  }
}
