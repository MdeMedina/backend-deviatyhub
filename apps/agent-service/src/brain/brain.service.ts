import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@deviaty/shared-prisma';
import { IntentionClassifier } from './intention.classifier';
import { StateManager, ConversationStep } from './state.manager';
import { AvailabilityTool } from '../tools/availability.tool';
import { HumanTool } from '../tools/human.tool';
import { AgentFormatter } from './agent.formatter';

@Injectable()
export class BrainService {
  private readonly logger = new Logger(BrainService.name);
  private model: ChatOpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly classifier: IntentionClassifier,
    private readonly stateManager: StateManager,
    private readonly availabilityTool: AvailabilityTool,
    private readonly humanTool: HumanTool,
  ) {
    this.model = new ChatOpenAI({
      openAIApiKey: this.configService.get('OPENAI_API_KEY'),
      modelName: 'gpt-5-mini',
      temperature: 0,
    });
  }

  async processMessage(params: {
    conversationId: string;
    clinicId: string;
    contact: any;
    history: any[];
    userInput: string;
    currentStep: string;
    metadata: any;
  }): Promise<{ text: string; nextStep?: string }> {
    
    // 1. Clasificar Intención (MVP simple antes del bucle de agente)
    const classification = await this.classifier.classify(params.userInput);
    
    // 2. Gestionar Fallback (2 strikes) - Mantenemos la lógica de la Fase 6
    if (classification.confidence < 0.8) {
      const retryCount = (params.metadata?.retry_count || 0) + 1;
      if (retryCount >= 2) {
        await this.humanTool.escalate(params.conversationId, 'Baja confianza en intención persistente');
        return { text: 'No te entiendo muy bien, te voy a derivar con uno de nuestros asesores.' };
      }
      await this.prisma.conversation.update({
        where: { id: params.conversationId },
        data: { metadata: { ...params.metadata, retry_count: retryCount } }
      });
      return { text: 'Disculpa, no entendí del todo tu solicitud. ¿Podrías explicármelo de otra forma?' };
    }

    // 3. Definir HERRAMIENTAS para el Agente
    const tools = [
      new DynamicStructuredTool({
        name: 'check_availability',
        description: 'Usa esta herramienta cuando el paciente pida una cita o pregunte por horarios para un día específico (ej: mañana, lunes, 20 de mayo).',
        schema: z.object({
          date: z.string().describe('Fecha en formato ISO (YYYY-MM-DD)'),
        }),
        func: async ({ date }) => {
          try {
            const slots = await this.availabilityTool.getAvailableSlots(params.clinicId, new Date(date));
            if (slots.length === 0) return 'No hay disponibilidad para ese día.';
            return `Horarios disponibles (mínimo 3 sugeridos): ${slots.join(', ')}`;
          } catch (e) {
            // Política de usuario: Escalar de inmediato si falla el tool
            await this.humanTool.escalate(params.conversationId, `Error en AvailabilityTool: ${e.message}`);
            return 'ERROR_TECNICO_ESCALANDO_A_HUMANO';
          }
        },
      }),
      new DynamicStructuredTool({
        name: 'escalate_to_human',
        description: 'Usa esta herramienta cuando el paciente pida hablar con una persona, tenga una urgencia dental grave o esté molesto.',
        schema: z.object({
          reason: z.string().describe('Razón de la escalada'),
        }),
        func: async ({ reason }) => {
          return await this.humanTool.escalate(params.conversationId, reason);
        },
      }),
    ];

    // 4. Crear Agente y Executor
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: params.clinicId },
      include: { config: true, treatments: true, schedules: true }
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', `Eres AmalIA, el asistente experto de la clínica dental "{clinicName}".
      
      REGLAS CRÍTICAS:
      - Responde siempre en el mismo idioma que el usuario ({detectedLanguage}).
      - Sé amable y conciso (máximo 3 oraciones).
      - Si el usuario quiere agendar, usa 'check_availability' para darle opciones reales. Ofrece entre 3 y 5 opciones.
      
      CONTEXTO DE CLÍNICA:
      - Horarios: {schedules}
      - Tratamientos: {treatments}
      
      ESTADO ACTUAL: {currentStep}
      INTENCIÓN DETECTADA: {intent}
      `],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const agent = await createOpenAIFunctionsAgent({
      llm: this.model,
      tools,
      prompt,
    });

    const executor = new AgentExecutor({
      agent,
      tools,
      verbose: true,
    });

    // 5. Ejecutar Agente
    const response = await executor.invoke({
      input: params.userInput,
      chat_history: AgentFormatter.formatHistory(params.history),
      clinicName: (clinic as any).name,
      detectedLanguage: 'el mismo idioma del usuario',
      schedules: JSON.stringify(clinic?.schedules || []),
      treatments: clinic?.treatments.map(t => `${t.name} ($${t.price})`).join(', ') || 'Consultar',
      currentStep: params.currentStep,
      intent: classification.intent,
    });

    // 6. Post-procesamiento: Actualizar Estado si no hubo escalada
    if (response.output !== 'ERROR_TECNICO_ESCALANDO_A_HUMANO') {
      await this.stateManager.calculateNextStep(
        params.conversationId,
        params.currentStep as ConversationStep,
        classification.intent,
        classification.confidence
      );
    }

    return { text: response.output };
  }
}
