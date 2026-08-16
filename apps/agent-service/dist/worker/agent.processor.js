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
var AgentProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const shared_prisma_1 = require("@deviaty/shared-prisma");
const brain_service_1 = require("../brain/brain.service");
const shared_events_1 = require("@deviaty/shared-events");
let AgentProcessor = AgentProcessor_1 = class AgentProcessor extends bullmq_1.WorkerHost {
    prisma;
    brain;
    eventBus;
    logger = new common_1.Logger(AgentProcessor_1.name);
    constructor(prisma, brain, eventBus) {
        super();
        this.prisma = prisma;
        this.brain = brain;
        this.eventBus = eventBus;
    }
    async process(job) {
        const { contact_id, message, clinic_id, conversation_id } = job.data;
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
                channel: conversation.channel,
            });
            this.logger.log(`Respuesta enviada y persistida para ${conversation_id}`);
        }
        catch (error) {
            this.logger.error(`Error procesando mensaje: ${error.message}`);
            throw error; // Para que BullMQ reintente según config
        }
    }
};
exports.AgentProcessor = AgentProcessor;
exports.AgentProcessor = AgentProcessor = AgentProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bullmq_1.Processor)('messages'),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __param(1, (0, common_1.Inject)(brain_service_1.BrainService)),
    __param(2, (0, common_1.Inject)(shared_events_1.EventBus)),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService,
        brain_service_1.BrainService,
        shared_events_1.EventBus])
], AgentProcessor);
//# sourceMappingURL=agent.processor.js.map