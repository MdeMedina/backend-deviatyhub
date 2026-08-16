import {
  Controller,
  Post,
  Body,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CurrentClinicId } from '@deviaty/shared-nestjs';
import { PrismaService } from '@deviaty/shared-prisma';
import { BrainService } from './brain/brain.service';

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(BrainService)
    private readonly brain: BrainService,
  ) {}

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
    });

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
      tools_used: [],
    };
  }
}
