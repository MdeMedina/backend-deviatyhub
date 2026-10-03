import {
  Controller,
  Post,
  Get,
  Body,
  Inject,
  BadRequestException,
  ForbiddenException,
  Headers,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CurrentClinicId } from '@deviaty/shared-nestjs';
import { PrismaService } from '@deviaty/shared-prisma';
import { BrainService } from './brain/brain.service';
import { agenteHabilitado } from '@deviaty/shared-utils';

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(BrainService)
    private readonly brain: BrainService,
    @InjectQueue('messages')
    private readonly cola: Queue,
  ) {}

  /**
   * Estado de la cola de mensajes entrantes, para el backoffice. Lo consulta
   * core por la red interna; el gateway corta /api/agent/internal a todo el
   * mundo, y la cabecera de superusuario es una segunda llave.
   */
  @Get('internal/queue')
  async estadoDeLaCola(@Headers('x-platform-admin') platformAdmin?: string) {
    if (platformAdmin !== 'true') throw new ForbiddenException();
    const [conteo, esperando, fallidos] = await Promise.all([
      this.cola.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed'),
      this.cola.getJobs(['waiting'], 0, 0, true),
      this.cola.getJobs(['failed'], 0, 199, false),
    ]);
    const hace24h = Date.now() - 24 * 60 * 60 * 1000;
    return {
      waiting: conteo.waiting ?? 0,
      active: conteo.active ?? 0,
      delayed: conteo.delayed ?? 0,
      depth: (conteo.waiting ?? 0) + (conteo.active ?? 0) + (conteo.delayed ?? 0),
      oldest_waiting_age_sec: esperando[0] ? Math.round((Date.now() - esperando[0].timestamp) / 1000) : 0,
      failed_last_24h: fallidos.filter((j) => (j.finishedOn ?? j.timestamp) >= hace24h).length,
    };
  }

  @Post('simulate')
  async simulate(
    @CurrentClinicId() clinicId: string,
    @Body() body: { message: string; session_id?: string },
  ) {
    if (!clinicId) {
      throw new BadRequestException('x-clinic-id header is required');
    }

    const { message, session_id } = body;
    if (!message || !message.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }

    this.logger.log(`Simulation request for clinic: ${clinicId}, session: ${session_id}`);

    // Con el agente apagado desde la plataforma, el simulador lo dice en vez
    // de mostrar respuestas que por WhatsApp nunca se enviarían.
    const clinica = await this.prisma.clinic.findUnique({ where: { id: clinicId }, select: { entitlements: true } });
    if (!agenteHabilitado(clinica?.entitlements)) {
      return {
        session_id: session_id ?? null,
        response: 'El agente está desactivado para esta clínica desde la plataforma. Escríbenos para activarlo.',
        current_step: null,
        intention: null,
        certainty: null,
        tools_used: [],
      };
    }

    let conversation;

    if (session_id) {
      conversation = await this.prisma.conversation.findUnique({
        where: { id: session_id },
        include: { contact: true },
      });
    }

    if (!conversation) {
      // Look up or create a simulated contact
      let contact = await this.prisma.clinicContact.findFirst({
        where: {
          clinicId,
          phone: '56900000000',
        },
      });

      if (!contact) {
        contact = await this.prisma.clinicContact.create({
          data: {
            clinicId,
            name: 'Paciente Simulado',
            phone: '56900000000',
            email: 'simulado@deviaty.com',
          },
        });
      }

      // Create a new simulation conversation
      conversation = await this.prisma.conversation.create({
        data: {
          clinicId,
          contactId: contact.id,
          channel: 'SIMULATOR',
          status: 'OPEN',
          currentStep: 'inicio',
          metadata: { retry_count: 0 },
        },
        include: { contact: true },
      });
    }

    // 1. Save user message to BDD
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        clinicId,
        role: 'USER',
        content: message,
        sentAt: new Date(),
      },
    });

    // 2. Load latest messages for LLM context (reverse order so oldest is first)
    const messages = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { sentAt: 'desc' },
      take: 10,
    });

    // 3. Process the message using BrainService
    const response = await this.brain.processMessage({
      conversationId: conversation.id,
      clinicId,
      contact: conversation.contact as any,
      history: messages.reverse(),
      userInput: message,
      currentStep: conversation.currentStep || 'inicio',
      metadata: conversation.metadata || {},
      simulate: true,
    });

    // Telemetría: también cuesta tokens, aunque no se envíe a nadie.
    await this.prisma.agentTurn
      .create({
        data: {
          clinicId,
          conversationId: conversation.id,
          channel: 'SIMULATOR',
          simulated: true,
          outcome: 'replied',
          intent: response.intent,
          model: response.usage?.model ?? null,
          promptTokens: response.usage?.promptTokens ?? 0,
          completionTokens: response.usage?.completionTokens ?? 0,
          costUsd: response.usage?.costUsd ?? 0,
          llmMs: response.usage?.llmMs ?? null,
          parseError: response.usage?.parseError ?? false,
        },
      })
      .catch(() => undefined);

    // 4. Save agent response to BDD
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        clinicId,
        role: 'ASSISTANT',
        content: response.text,
        sentAt: new Date(),
      },
    });

    return {
      session_id: conversation.id,
      response: response.text,
      current_step: response.currentStep,
      intention: response.intent,
      certainty: response.certainty,
      tools_used: response.toolsUsed,
    };
  }
}
