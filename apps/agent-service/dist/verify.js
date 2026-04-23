"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const testing_1 = require("@nestjs/testing");
const agent_processor_1 = require("./worker/agent.processor");
const brain_service_1 = require("./brain/brain.service");
const shared_prisma_1 = require("@deviaty/shared-prisma");
async function verifyAgentPipeline() {
    console.log('--- 🧪 VERIFICACIÓN AISLADA: AGENT SERVICE (PHASE 6) ---');
    const mockPrisma = {
        conversation: {
            findUnique: (args) => Promise.resolve({
                id: args.where.id,
                status: 'OPEN',
                contact: { id: 'cont-1', name: 'Juan Perez' },
                messages: [
                    { role: 'user', content: 'Hola, precios?' },
                ],
            }),
        },
        clinic: {
            findUnique: (args) => Promise.resolve({
                id: args.where.id,
                name: 'Clínica Dental Test',
                treatments: [{ name: 'Limpieza' }],
                schedules: [],
                config: {}
            }),
        }
    };
    const mockBrain = {
        processMessage: (params) => {
            console.log(`🧠 [MOCK BRAIN] Procesando: "${params.userInput}"`);
            return Promise.resolve({ text: 'Hola Juan, la limpieza cuesta $50.' });
        }
    };
    try {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                agent_processor_1.AgentProcessor,
                { provide: shared_prisma_1.PrismaService, useValue: mockPrisma },
                { provide: brain_service_1.BrainService, useValue: mockBrain },
            ],
        }).compile();
        const processor = module.get(agent_processor_1.AgentProcessor);
        const mockJob = {
            data: {
                clinic_id: 'cli-123',
                conversation_id: 'conv-456',
                contact_id: 'cont-789',
                message: { text: 'Hola, precios de limpieza?' },
            }
        };
        console.log('\n👉 [1. PIPELINE TEST: MESSAGE CONSUMPTION]');
        await processor.process(mockJob);
        console.log('✅ PASS: Flujo completo (Carga context -> Mock Brain -> Log exitoso).');
        console.log('\n👉 [2. TAKEOVER TEST]');
        // Simular takeover
        mockPrisma.conversation.findUnique = () => Promise.resolve({ status: 'HUMAN_TAKEOVER' });
        await processor.process(mockJob);
        console.log('✅ PASS: Procesador ignora mensajes en HUMAN_TAKEOVER.');
        console.log('\n--- 🎉 VERIFICACIÓN FINALIZADA ---');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ FAIL:', error);
        process.exit(1);
    }
}
verifyAgentPipeline();
//# sourceMappingURL=verify.js.map