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
var BrainService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrainService = void 0;
const common_1 = require("@nestjs/common");
const openai_1 = require("@langchain/openai");
const prompts_1 = require("@langchain/core/prompts");
const output_parsers_1 = require("@langchain/core/output_parsers");
const config_1 = require("@nestjs/config");
const shared_prisma_1 = require("@deviaty/shared-prisma");
let BrainService = BrainService_1 = class BrainService {
    configService;
    prisma;
    logger = new common_1.Logger(BrainService_1.name);
    model;
    constructor(configService, prisma) {
        this.configService = configService;
        this.prisma = prisma;
        const apiKey = this.configService.get('OPENAI_API_KEY');
        this.model = new openai_1.ChatOpenAI({
            openAIApiKey: apiKey,
            modelName: 'gpt-4o',
            temperature: 0, // Determinístico para flujos de agendamiento
        });
    }
    async processMessage(params) {
        // 1. Cargar contexto extendido de la clínica (Redis/Prisma)
        const clinic = await this.prisma.clinic.findUnique({
            where: { id: params.clinicId },
            include: {
                config: true,
                treatments: true,
                schedules: true,
            }
        });
        if (!clinic)
            throw new Error('Clínica no encontrada.');
        // 2. Construir Prompt (Placeholder simple para el bootstrap)
        const prompt = prompts_1.PromptTemplate.fromTemplate(`
      Eres AmalIA, el asistente inteligente de la clínica {clinicName}.
      
      CONTEXTO DE LA CLÍNICA:
      - Horarios: {schedules}
      - Tratamientos: {treatments}
      
      ESTADO ACTUAL: {currentStep}
      PACIENTE: {patientName}
      
      HISTORIAL:
      {history}
      
      MENSAJE DEL PACIENTE: {userInput}
      
      INSTRUCCIONES:
      - Sé amable y conciso (máximo 3 oraciones).
      - Si el paciente quiere agendar, guía la conversación según el estado.
      - Responde solo basándote en la información provista.
      
      RESPUESTA:
    `);
        const chain = prompt.pipe(this.model).pipe(new output_parsers_1.StringOutputParser());
        const result = await chain.invoke({
            clinicName: clinic.name,
            schedules: JSON.stringify(clinic.schedules),
            treatments: clinic.treatments.map(t => t.name).join(', '),
            currentStep: params.currentStep,
            patientName: params.contact.name || 'Paciente',
            history: params.history.map(m => `${m.role}: ${m.content}`).join('\n'),
            userInput: params.userInput,
        });
        return { text: result };
    }
};
exports.BrainService = BrainService;
exports.BrainService = BrainService = BrainService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        shared_prisma_1.PrismaService])
], BrainService);
//# sourceMappingURL=brain.service.js.map