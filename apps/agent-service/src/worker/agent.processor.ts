import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { BrainService } from '../brain/brain.service';
import { EventBus } from '@deviaty/shared-events';

@Injectable()
@Processor('messages')
export class AgentProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentProcessor.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(BrainService)
    private readonly brain: BrainService,
    @Inject(EventBus)
    private readonly eventBus: EventBus,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { contact_id, message, clinic_id, conversation_id } = job.data;
    
    this.logger.log(`🤖 Procesando mensaje para contacto ${contact_id} en clínica ${clinic_id}`);

    try {
      // 1. Cargar contexto de la conversación
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversation_id },
        include: {
          contact: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!conversation) {
        this.logger.error(`Conversación ${conversation_id} no encontrada.`);
        return;
      }

      // Si está en takeover humano, ignorar
      if (conversation.status === 'HUMAN_TAKEOVER') {
        this.logger.warn(`Conversación ${conversation_id} está en HUMAN_TAKEOVER. Ignorando.`);
        return;
      }

      // 2. Ejecutar "Cerebro" (LLM)
      const response = await this.brain.processMessage({
        clinicId: clinic_id,
        contact: conversation.contact,
        history: conversation.messages.reverse(),
        userInput: message.text || message.body,
        currentStep: conversation.currentStep || 'inicio',
        metadata: conversation.metadata || {},
      });

      // 3. Persistir respuesta en BDD
      await this.prisma.message.create({
        data: {
          conversationId: conversation_id,
          clinicId: clinic_id,
          role: 'ASSISTANT', // Usando string literal si no coincide el Enum exacto, pero idealmente MessageRole.ASSISTANT
          content: response.text,
          sentAt: new Date(),
        },
      });

      // 4. Publicar evento para WhatsApp Service
      await this.eventBus.publish('message.outbound', {
        conversationId: conversation_id,
        clinicId: clinic_id,
        recipient: conversation.contact?.phone || '', // Si no hay teléfono, el service fallará (esperado)
        content: response.text,
        channel: conversation.channel as any,
      });

      this.logger.log(`Respuesta enviada y persistida para ${conversation_id}`);

    } catch (error) {
      this.logger.error(`Error procesando mensaje: ${error.message}`);
      throw error; // Para que BullMQ reintente según config
    }
  }
}
