"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
const common_1 = require("@nestjs/common");
const shared_prisma_1 = require("@deviaty/shared-prisma");
let ConversationService = class ConversationService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(clinicId, filters) {
        const { status, channel, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;
        const where = {
            clinicId,
            ...(status ? { status: status } : {}),
            ...(channel ? { channel } : {}),
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
    async findOne(clinicId, id) {
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
        if (!conversation)
            throw new common_1.NotFoundException('Conversación no encontrada');
        return conversation;
    }
    async takeover(clinicId, id, userId) {
        const conversation = await this.findOne(clinicId, id);
        if (conversation.status === 'HUMAN_TAKEOVER') {
            return conversation; // Ya está en takeover
        }
        return this.prisma.conversation.update({
            where: { id },
            data: {
                status: 'HUMAN_TAKEOVER',
                assignedUserId: userId,
            },
        });
    }
    async release(clinicId, id) {
        await this.findOne(clinicId, id);
        return this.prisma.conversation.update({
            where: { id },
            data: {
                status: 'OPEN',
                assignedUserId: null,
            },
        });
    }
    async sendManualMessage(clinicId, id, userId, content) {
        const conversation = await this.findOne(clinicId, id);
        if (conversation.status !== 'HUMAN_TAKEOVER') {
            throw new common_1.ForbiddenException('NOT_IN_TAKEOVER: La conversación debe estar en modo intervención humana');
        }
        return this.prisma.message.create({
            data: {
                clinicId,
                conversationId: id,
                role: 'HUMAN',
                content,
            },
        });
    }
    async findContacts(clinicId, search, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = {
            clinicId,
            ...(search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
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
};
exports.ConversationService = ConversationService;
exports.ConversationService = ConversationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService])
], ConversationService);
//# sourceMappingURL=conversation.service.js.map