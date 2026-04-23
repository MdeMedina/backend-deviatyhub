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
    this.logger.log(`Escalando conversación ${conversationId} a humano. Razón: ${reason}`);

    // 1. Actualizar estado en Prisma
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'HUMAN_TAKEOVER' },
    });

    // 2. Publicar evento para Core Service (WebSocket notify)
    await this.eventBus.publish(AppEvents.HUMAN_ESCALATION, {
      conversationId,
      reason,
      timestamp: new Date(),
    });

    return 'Conectando con un asesor humano...';
  }
}
