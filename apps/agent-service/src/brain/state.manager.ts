import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { Intent } from './intention.classifier';

export type ConversationStep = 
  | 'inicio'
  | 'esperando_tratamiento'
  | 'esperando_fecha'
  | 'esperando_horario'
  | 'esperando_datos_personales'
  | 'listo_para_ejecucion'
  | 'concluido';

@Injectable()
export class StateManager {
  private readonly logger = new Logger(StateManager.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateNextStep(
    conversationId: string,
    currentStep: ConversationStep,
    intent: Intent,
    confidence: number
  ): Promise<ConversationStep> {
    
    // Lógica de 2 intentos para baja confianza (se gestionará en BrainService con contador)
    if (confidence < 0.8) {
      return currentStep; // Mantener estado para re-intento
    }

    let nextStep: ConversationStep = currentStep;

    // Máquina de estados simplificada para agendamiento
    switch (currentStep) {
      case 'inicio':
        if (intent === Intent.AGENDAR_CITA) nextStep = 'esperando_tratamiento';
        break;
      
      case 'esperando_tratamiento':
        // El LLM valida el tratamiento, aquí solo avanzamos si el flujo prosigue
        nextStep = 'esperando_fecha';
        break;

      case 'esperando_fecha':
        nextStep = 'esperando_horario';
        break;

      case 'esperando_horario':
        nextStep = 'esperando_datos_personales';
        break;

      case 'esperando_datos_personales':
        nextStep = 'listo_para_ejecucion';
        break;
    }

    // Si cambió el estado, persistir en Prisma
    if (nextStep !== currentStep) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { currentStep: nextStep }
      });
      this.logger.log(`Transición de estado: ${currentStep} -> ${nextStep}`);
    }

    return nextStep;
  }
}
