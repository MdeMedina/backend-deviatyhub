import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { ConversationFilterDto } from './dto/conversation.dto';
import { ConversationGateway } from './conversation.gateway';

@Injectable()
export class ConversationService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConversationGateway)
    private readonly gateway: ConversationGateway
  ) {}

  async findAll(clinicId: string, filters: ConversationFilterDto) {
    const { status, channel, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      clinicId,
      ...(status ? { status: status as any } : {}),
      ...(channel ? { channel } : { channel: { not: 'SIMULATOR' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          contact: true,
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(clinicId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, clinicId },
      include: {
        contact: true,
        messages: { orderBy: { sentAt: 'asc' } },
        appointments: {
          take: 1,
          orderBy: { scheduledAt: 'desc' },
          include: { treatment: true, doctor: true },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversación no encontrada');
    return conversation;
  }

  async takeover(clinicId: string, id: string, userId: string) {
    const conversation = await this.findOne(clinicId, id);
    
    if (conversation.status === 'HUMAN_TAKEOVER') {
      return conversation; // Ya está en takeover
    }

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        status: 'HUMAN_TAKEOVER',
        assignedUserId: userId,
      },
    });

    this.gateway.emitEvent('conversation.status_changed', {
      conversation_id: id,
      status: 'HUMAN_TAKEOVER',
    });

    return updated;
  }

  async release(clinicId: string, id: string) {
    await this.findOne(clinicId, id);

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        status: 'OPEN',
        assignedUserId: null,
      },
    });

    this.gateway.emitEvent('conversation.status_changed', {
      conversation_id: id,
      status: 'OPEN',
    });

    return updated;
  }

  async sendManualMessage(clinicId: string, id: string, userId: string, content: string) {
    const conversation = await this.findOne(clinicId, id);

    if (conversation.status !== 'HUMAN_TAKEOVER') {
      throw new ForbiddenException('NOT_IN_TAKEOVER: La conversación debe estar en modo intervención humana');
    }

    const message = await this.prisma.message.create({
      data: {
        clinicId,
        conversationId: id,
        role: 'HUMAN',
        content,
      },
    });

    this.gateway.emitEvent('conversation.message', {
      conversation_id: id,
      message,
    });

    return message;
  }

  async findContacts(clinicId: string, search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = {
      clinicId,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as any } },
          { phone: { contains: search } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.clinicContact.findMany({
        where,
        orderBy: { lastInteractionAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.clinicContact.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
}
