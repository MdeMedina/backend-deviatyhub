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
    confidence: number,
    bookingState?: any
  ): Promise<ConversationStep> {
    
    // Lógica de 2 intentos para baja confianza
    if (confidence < 0.8) {
      return currentStep; // Mantener estado para re-intento
    }

    let nextStep: ConversationStep = currentStep;
    const booking = bookingState || {};

    // Máquina de estados con guardas de validación basadas en datos reales
    switch (currentStep) {
      case 'inicio':
        if (intent === Intent.AGENDAR_CITA) {
          nextStep = booking.procedimiento_id ? 'esperando_fecha' : 'esperando_tratamiento';
        }
        break;
      
      case 'esperando_tratamiento':
        if (booking.procedimiento_id) {
          nextStep = booking.fecha ? 'esperando_horario' : 'esperando_fecha';
        }
        break;

      case 'esperando_fecha':
        if (booking.fecha) {
          nextStep = booking.hora ? 'esperando_datos_personales' : 'esperando_horario';
        }
        break;

      case 'esperando_horario':
        if (booking.hora) {
          nextStep = (booking.Nombre && booking.Apellido && booking.correo) ? 'listo_para_ejecucion' : 'esperando_datos_personales';
        }
        break;

      case 'esperando_datos_personales':
        if (booking.Nombre && booking.Apellido && booking.correo) {
          nextStep = 'listo_para_ejecucion';
        }
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
