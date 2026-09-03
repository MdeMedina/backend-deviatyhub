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
    let data = job.data;

    // El webhook encola el payload CRUDO de Meta ({ channel, payload }).
    // Lo normalizamos aquí: parsear el mensaje, resolver/crear contacto y
    // conversación, y persistir el mensaje entrante.
    if (data?.payload && data?.channel) {
      const normalized = await this.normalizeInbound(data.channel, data.payload);
      if (!normalized) {
        this.logger.log('Webhook sin mensaje procesable (status/echo). Ignorado.');
        return;
      }
      data = normalized;
    }

    const { contact_id, message, clinic_id, conversation_id } = data;
    this.logger.log(`🤖 Procesando mensaje para contacto ${contact_id} en clínica ${clinic_id}`);

    try {
      // 1. Cargar contexto de la conversación
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversation_id },
        include: {
          contact: true,
          messages: {
            orderBy: { sentAt: 'desc' },
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
        conversationId: conversation_id,
        clinicId: clinic_id,
        contact: conversation.contact as any,
        history: (conversation as any).messages.reverse(),
        userInput: message.text || message.body,
        currentStep: conversation.currentStep || 'inicio',
        metadata: conversation.metadata || {},
      });

      // 3. Persistir respuesta en BDD
      await this.prisma.message.create({
        data: {
          conversationId: conversation_id,
          clinicId: clinic_id,
          role: 'ASSISTANT',
          content: response.text,
          sentAt: new Date(),
        },
      });

      // 3.b Persistir el paso de la FSM si el cerebro lo devolvió
      if ((response as any).currentStep) {
        await this.prisma.conversation
          .update({ where: { id: conversation_id }, data: { currentStep: (response as any).currentStep } })
          .catch(() => undefined);
      }

      // 4. Publicar evento para WhatsApp Service (envío saliente)
      await this.eventBus.publish('message.outbound', {
        conversationId: conversation_id,
        clinicId: clinic_id,
        recipient: (conversation.contact as any)?.phone || '',
        content: response.text,
        channel: conversation.channel as any,
      });

      this.logger.log(`Respuesta enviada y persistida para ${conversation_id}`);
    } catch (error) {
      this.logger.error(`Error procesando mensaje: ${(error as Error).message}`);
      throw error; // Para que BullMQ reintente según config
    }
  }

  /**
   * Convierte un payload crudo de la WhatsApp Cloud API en datos normalizados,
   * creando/resolviendo el contacto y la conversación y persistiendo el mensaje
   * entrante. Devuelve null si el webhook no trae un mensaje (p.ej. actualizaciones
   * de estado como "delivered"/"read").
   */
  private async normalizeInbound(
    _channel: string,
    payload: any,
  ): Promise<{ contact_id: string; message: { text: string }; clinic_id: string; conversation_id: string } | null> {
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg) return null; // status updates / sin mensaje

    // Extraer el texto según el tipo de mensaje
    let text = '';
    if (msg.type === 'text') text = msg.text?.body || '';
    else if (msg.type === 'button') text = msg.button?.text || '';
    else if (msg.type === 'interactive')
      text = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
    if (!text) text = '[mensaje no soportado]';

    const fromPhone: string = msg.from; // dígitos E.164 sin '+', ej: 56912345678
    if (!fromPhone) return null;
    const profileName = value?.contacts?.[0]?.profile?.name || null;

    // Resolver clínica. Demo: clínica única. (Multi-tenant: mapear por
    // value.metadata.phone_number_id contra clinic_integrations.)
    const clinic = await this.prisma.clinic.findFirst();
    if (!clinic) {
      this.logger.error('No hay clínica configurada para asociar el mensaje entrante.');
      return null;
    }
    const clinic_id = clinic.id;

    // Resolver/crear contacto por teléfono (toleramos con y sin '+')
    const plus = `+${fromPhone}`;
    let contact = await this.prisma.clinicContact.findFirst({
      where: { clinicId: clinic_id, OR: [{ phone: fromPhone }, { phone: plus }] },
    });
    if (!contact) {
      contact = await this.prisma.clinicContact.create({
        data: { clinicId: clinic_id, phone: fromPhone, name: profileName, lastInteractionAt: new Date() },
      });
    } else {
      await this.prisma.clinicContact
        .update({
          where: { id: contact.id },
          data: { lastInteractionAt: new Date(), name: contact.name || profileName },
        })
        .catch(() => undefined);
    }

    // Resolver/crear conversación abierta (no cerrada) para ese contacto
    let conversation = await this.prisma.conversation.findFirst({
      where: { clinicId: clinic_id, contactId: contact.id, status: { not: 'CLOSED' } },
      orderBy: { startedAt: 'desc' },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { clinicId: clinic_id, contactId: contact.id, channel: 'WHATSAPP', status: 'OPEN', currentStep: 'inicio' },
      });
    }

    // Persistir el mensaje entrante (rol USER)
    await this.prisma.message.create({
      data: { conversationId: conversation.id, clinicId: clinic_id, role: 'USER', content: text, sentAt: new Date() },
    });

    return { contact_id: contact.id, message: { text }, clinic_id, conversation_id: conversation.id };
  }
}
