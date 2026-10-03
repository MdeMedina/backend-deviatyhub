import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { BrainService } from '../brain/brain.service';
import { EventBus } from '@deviaty/shared-events';
import { EnrutadorDeClinica, numeroDeDestino } from './clinic-router';
import { agenteHabilitado } from '@deviaty/shared-utils';
import type { UsoDelTurno } from '../brain/usage';

/**
 * Corta-bucles.
 *
 * El 29/09 el agente pasó 3,5 horas contestando al bot de ofertas de otra
 * empresa: cada respuesta nuestra disparaba su mensaje automático y viceversa.
 * 864 respuestas, el mismo texto del otro lado 682 veces. Cada vuelta, una
 * llamada al modelo con ~8.000 tokens de prompt y un envío por WhatsApp, que es
 * el patrón por el que Meta marca un número como spam.
 *
 * Se decide sin el modelo, con dos señales que un paciente real no produce:
 *
 * - El MISMO mensaje largo repetido. Un bot repite su texto automático; una
 *   persona no escribe tres veces idéntico un párrafo. Los cortos se excluyen a
 *   propósito: "si", "ok" o "gracias" se repiten de forma natural en una
 *   reserva, y cortarlos dejaría a pacientes de verdad sin respuesta.
 * - Demasiadas respuestas nuestras en una hora. Una reserva completa son unos
 *   quince turnos; cuarenta en una hora no es una conversación.
 */
export const BUCLE = {
  minLargoRepetido: 25,
  repeticionesMax: 3,
  ventanaRepeticionMin: 15,
  respuestasMaxPorHora: 40,
};

export function normalizarParaBucle(texto: string): string {
  return String(texto || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function motivoDeBucle(
  entrantesRecientes: string[],
  textoActual: string,
  respuestasUltimaHora: number,
): string | null {
  const actual = normalizarParaBucle(textoActual);

  if (actual.length >= BUCLE.minLargoRepetido) {
    const iguales = entrantesRecientes.filter((t) => normalizarParaBucle(t) === actual).length;
    if (iguales >= BUCLE.repeticionesMax) {
      return `el mismo mensaje llegó ${iguales} veces en ${BUCLE.ventanaRepeticionMin} minutos`;
    }
  }

  if (respuestasUltimaHora >= BUCLE.respuestasMaxPorHora) {
    return `ya se enviaron ${respuestasUltimaHora} respuestas en la última hora`;
  }

  return null;
}

@Injectable()
@Processor('messages')
export class AgentProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentProcessor.name);
  private readonly enrutador: EnrutadorDeClinica;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(BrainService)
    private readonly brain: BrainService,
    @Inject(EventBus)
    private readonly eventBus: EventBus,
  ) {
    super();
    this.enrutador = new EnrutadorDeClinica(this.prisma as any, {
      secreto: process.env.JWT_ACCESS_SECRET,
      numeroGlobal: process.env.WHATSAPP_PHONE_NUMBER_ID,
      clinicaPorDefecto: process.env.WHATSAPP_DEFAULT_CLINIC_ID || undefined,
      avisar: (m) => this.logger.warn(m),
    });
  }

  /** Avisa al Core para que el panel refresque la conversación en vivo. */
  private async notifyMessage(conversationId: string, message: any) {
    await this.eventBus
      .publish('conversation.message', { conversationId, message })
      .catch((e) => this.logger.warn(`No se pudo notificar el mensaje: ${(e as Error).message}`));
  }

  /**
   * Telemetría de un turno. Nunca interrumpe el flujo: si no se puede guardar,
   * el paciente igual recibe su respuesta.
   */
  private async registrarTurno(t: {
    clinicId: string;
    conversationId?: string;
    channel: string;
    outcome: 'replied' | 'paused' | 'blocked' | 'takeover' | 'loop' | 'error';
    intent?: string;
    usage?: UsoDelTurno;
    enviadoPorPaciente?: number | null;
    encolado?: number;
    inicio: number;
    webhookMs?: number | null;
    error?: string;
  }) {
    const ahora = Date.now();
    await this.prisma.agentTurn
      .create({
        data: {
          clinicId: t.clinicId,
          conversationId: t.conversationId ?? null,
          channel: t.channel,
          outcome: t.outcome,
          intent: t.intent ?? null,
          model: t.usage?.model ?? null,
          promptTokens: t.usage?.promptTokens ?? 0,
          completionTokens: t.usage?.completionTokens ?? 0,
          costUsd: t.usage?.costUsd ?? 0,
          llmMs: t.usage?.llmMs ?? null,
          parseError: t.usage?.parseError ?? false,
          // La marca de Meta va en segundos: la latencia de punta a punta tiene
          // ±1 s de precisión, suficiente para metas de 4 y 12 segundos.
          endToEndMs: t.outcome === 'replied' && t.enviadoPorPaciente ? Math.max(0, ahora - t.enviadoPorPaciente) : null,
          queueMs: t.encolado ? Math.max(0, t.inicio - t.encolado) : null,
          webhookMs: t.webhookMs ?? null,
          error: t.error?.slice(0, 500) ?? null,
        },
      })
      .catch((e) => this.logger.warn(`No se pudo guardar la telemetría del turno: ${(e as Error).message}`));
  }

  async process(job: Job<any, any, string>): Promise<any> {
    let data = job.data;
    const inicio = Date.now();
    const webhookMs: number | null = typeof job.data?.webhookMs === 'number' ? job.data.webhookMs : null;

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

    const { contact_id, message, clinic_id, conversation_id, user_message_id } = data;
    this.logger.log(`🤖 Procesando mensaje para contacto ${contact_id} en clínica ${clinic_id}`);
    const turno = {
      clinicId: clinic_id,
      conversationId: conversation_id,
      channel: 'WHATSAPP',
      enviadoPorPaciente: data.sent_at_ms ?? null,
      encolado: job.timestamp,
      inicio,
      webhookMs,
    };

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

      turno.channel = String(conversation.channel || 'WHATSAPP');

      // Si está en takeover humano, ignorar
      if (conversation.status === 'HUMAN_TAKEOVER') {
        this.logger.warn(`Conversación ${conversation_id} está en HUMAN_TAKEOVER. Ignorando.`);
        await this.registrarTurno({ ...turno, outcome: 'takeover' });
        return;
      }

      // 1.b Modo pausado: el agente no contesta. El mensaje del paciente ya
      // quedó guardado, así que la conversación aparece en la bandeja para que
      // la atienda el equipo; simplemente no se genera ni se envía respuesta.
      const agentConfig = await this.prisma.agentConfig.findUnique({
        where: { clinicId: clinic_id },
      });
      if ((agentConfig as any)?.mode === 'PAUSED') {
        this.logger.warn(
          `Agente en PAUSA para la clínica ${clinic_id}. No se responde a ${conversation_id}.`,
        );
        await this.registrarTurno({ ...turno, outcome: 'paused' });
        return;
      }

      // 1.b' Bloqueo desde la plataforma: clínica suspendida, agente apagado o
      //      canal no habilitado. Igual que la pausa, el mensaje queda en la
      //      bandeja; la diferencia es que esto lo decide el backoffice y la
      //      clínica no lo puede revertir desde su panel.
      const clinica = await this.prisma.clinic.findUnique({
        where: { id: clinic_id },
        select: { active: true, entitlements: true },
      });
      const canal = String(conversation.channel || '').toLowerCase() === 'instagram' ? 'instagram' : 'whatsapp';
      if (clinica?.active === false || !agenteHabilitado(clinica?.entitlements, canal)) {
        this.logger.warn(
          `Agente bloqueado por la plataforma para la clínica ${clinic_id} (canal ${canal}). No se responde a ${conversation_id}.`,
        );
        await this.registrarTurno({ ...turno, outcome: 'blocked' });
        return;
      }

      // 1.c Corta-bucles, ANTES del modelo: un bucle no debe costar ni una
      //     llamada más. Si salta, la conversación pasa a una persona y el
      //     agente deja de contestar; el aviso queda en el hilo para que el
      //     equipo vea por qué.
      const textoEntrante = String(message.text || message.body || '');
      const desde15 = new Date(Date.now() - BUCLE.ventanaRepeticionMin * 60 * 1000);
      const desde60 = new Date(Date.now() - 60 * 60 * 1000);

      const [entrantes, respuestasHora] = await Promise.all([
        this.prisma.message.findMany({
          where: { conversationId: conversation_id, role: 'USER', sentAt: { gte: desde15 } },
          select: { content: true },
        }),
        this.prisma.message.count({
          where: { conversationId: conversation_id, role: 'ASSISTANT', sentAt: { gte: desde60 } },
        }),
      ]);

      const motivo = motivoDeBucle(
        entrantes.map((m) => m.content),
        textoEntrante,
        respuestasHora,
      );

      if (motivo) {
        this.logger.error(
          `🛑 Corta-bucles en ${conversation_id}: ${motivo}. Se deja de responder y se pasa a una persona.`,
        );
        await this.prisma.conversation.update({
          where: { id: conversation_id },
          data: { status: 'HUMAN_TAKEOVER' },
        });
        const aviso = await this.prisma.message.create({
          data: {
            conversationId: conversation_id,
            clinicId: clinic_id,
            role: 'SYSTEM',
            content:
              `El agente dejó de responder automáticamente: ${motivo}. ` +
              `Suele indicar que al otro lado hay otro bot. Revisa la conversación y, si es un paciente, libérala.`,
            sentAt: new Date(),
          },
        });
        await this.notifyMessage(conversation_id, aviso);
        await this.registrarTurno({ ...turno, outcome: 'loop' });
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
      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId: conversation_id,
          clinicId: clinic_id,
          role: 'ASSISTANT',
          content: response.text,
          sentAt: new Date(),
        },
      });

      await this.notifyMessage(conversation_id, assistantMessage);

      // 3.a Guardar la intención detectada en el mensaje del paciente. El
      // clasificador ya la calcula en cada turno, pero hasta ahora no se
      // persistía en ninguna parte, así que el panel de métricas no tenía de
      // dónde sacar la distribución de intenciones.
      if (user_message_id && (response as any).intent) {
        await this.prisma.message
          .update({
            where: { id: user_message_id },
            data: {
              langchainMeta: {
                intent: (response as any).intent,
                certainty: (response as any).certainty ?? null,
              },
            },
          })
          .catch(() => undefined);
      }

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
      await this.registrarTurno({ ...turno, outcome: 'replied', intent: response.intent, usage: response.usage });
    } catch (error) {
      this.logger.error(`Error procesando mensaje: ${(error as Error).message}`);
      await this.registrarTurno({ ...turno, outcome: 'error', error: (error as Error).message });
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
  ): Promise<{
    contact_id: string;
    message: { text: string };
    clinic_id: string;
    conversation_id: string;
    user_message_id: string;
    sent_at_ms: number | null;
  } | null> {
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
    // En un webhook agrupado, `contacts` trae a todos los remitentes: se toma el de este mensaje.
    const remitente = (value?.contacts || []).find((c: any) => c?.wa_id === fromPhone) || value?.contacts?.[0];
    const profileName = remitente?.profile?.name || null;

    // La clínica la decide el número al que escribió el paciente.
    const enrutado = await this.enrutador.clinicaDe(numeroDeDestino(payload));
    if (enrutado.clinicId === null) {
      this.logger.error(`Mensaje entrante descartado: ${enrutado.motivo}.`);
      return null;
    }
    const clinic_id = enrutado.clinicId;

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
    const userMessage = await this.prisma.message.create({
      data: { conversationId: conversation.id, clinicId: clinic_id, role: 'USER', content: text, sentAt: new Date() },
    });

    // El mensaje del paciente también tiene que aparecer en el panel al vuelo.
    await this.notifyMessage(conversation.id, userMessage);

    return {
      contact_id: contact.id,
      message: { text },
      clinic_id,
      conversation_id: conversation.id,
      user_message_id: userMessage.id,
      // Cuándo lo envió el paciente según Meta (en segundos).
      sent_at_ms: Number(msg.timestamp) > 0 ? Number(msg.timestamp) * 1000 : null,
    };
  }
}
