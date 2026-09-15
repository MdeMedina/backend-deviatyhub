import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { Prisma, PrismaService } from '@deviaty/shared-prisma';
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

    // La bandeja tiene que ordenarse por actividad, no por cuándo se abrió la
    // conversación: ordenando por started_at, un chat abierto hace días pero con
    // un mensaje recién llegado quedaba enterrado bajo otros más nuevos e
    // inactivos, y parecía que el mensaje no se había registrado.
    //
    // Prisma no sabe ordenar por el máximo de una relación, así que el orden se
    // resuelve en SQL. Se hace sobre la tabla de mensajes en vez de con una
    // columna desnormalizada para que valga sea cual sea el servicio que lo
    // escribió: basta con que el mensaje exista.
    const statusFilter = status ? Prisma.sql`AND c.status::text = ${status}` : Prisma.empty;
    const channelFilter = channel
      ? Prisma.sql`AND c.channel::text = ${channel}`
      : Prisma.sql`AND c.channel <> 'SIMULATOR'`;

    const ordered = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id
      FROM conversations c
      WHERE c.clinic_id = ${clinicId}::uuid
        ${statusFilter}
        ${channelFilter}
      ORDER BY COALESCE(
        (SELECT MAX(m.sent_at) FROM messages m WHERE m.conversation_id = c.id),
        c.started_at
      ) DESC
      LIMIT ${limit} OFFSET ${skip}
    `;
    const orderedIds = ordered.map((r) => r.id);

    const [rows, total] = await Promise.all([
      orderedIds.length
        ? this.prisma.conversation.findMany({
            where: { id: { in: orderedIds } },
            include: {
              contact: true,
              messages: {
                orderBy: { sentAt: 'desc' },
                take: 1,
              },
            },
          })
        : Promise.resolve([]),
      this.prisma.conversation.count({ where }),
    ]);

    // findMany con "in" no respeta el orden de la lista, hay que reponerlo.
    const byId = new Map(rows.map((r) => [r.id, r]));
    const data = orderedIds.map((id) => byId.get(id)).filter(Boolean);

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

    // Al escalar, el flujo queda marcado como 'human_takeover', un paso que la
    // máquina de estados no sabe continuar. Devolver solo el status dejaba la
    // conversación abierta pero incapaz de completar una reserva para siempre.
    const conversation = await this.prisma.conversation.findUnique({ where: { id } });
    const stepAtascado = conversation?.currentStep === 'human_takeover' || !conversation?.currentStep;

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        status: 'OPEN',
        assignedUserId: null,
        ...(stepAtascado ? { currentStep: 'inicio' } : {}),
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
