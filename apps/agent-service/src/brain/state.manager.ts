import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { Intent } from './intention.classifier';

export type ConversationStep = 
  | 'inicio'
  | 'esperando_tratamiento'
  | 'esperando_doctor'
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
    bookingState?: any,
    // La agenda es la de un profesional concreto, no la de la clínica. Cuando
    // el tratamiento lo atiende más de uno hay que saber con quién antes de
    // hablar de horas, porque las horas libres dependen de esa elección.
    requiereEleccionDoctor = false,
  ): Promise<ConversationStep> {
    
    // Lógica de 2 intentos para baja confianza
    if (confidence < 0.8) {
      return currentStep; // Mantener estado para re-intento
    }

    let nextStep: ConversationStep = currentStep;
    const booking = bookingState || {};

    // Recuperación ante estados sin salida. Si ya están todos los datos, la
    // reserva puede ejecutarse aunque la conversación haya quedado en un paso
    // que no tiene transición, como 'human_takeover' tras liberar un takeover:
    // la máquina no sabía salir de ahí y el agente seguía respondiendo sin
    // poder agendar nunca, repitiéndole al paciente que ya casi está.
    const datosCompletos =
      booking.procedimiento_id &&
      booking.fecha &&
      booking.hora &&
      booking.Nombre &&
      booking.Apellido &&
      booking.correo;

    const pasoConocido: ConversationStep[] = [
      'inicio',
      'esperando_tratamiento',
      'esperando_doctor',
      'esperando_fecha',
      'esperando_horario',
      'esperando_datos_personales',
      'listo_para_ejecucion',
    ];

    if (datosCompletos && currentStep !== 'concluido' && currentStep !== 'listo_para_ejecucion') {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { currentStep: 'listo_para_ejecucion' },
      });
      return 'listo_para_ejecucion';
    }

    // Si el paso guardado no pertenece a la máquina, se vuelve al inicio en vez
    // de quedarse bloqueado indefinidamente.
    if (!pasoConocido.includes(currentStep)) {
      currentStep = 'inicio';
      nextStep = 'inicio';
    }

    // Con el tratamiento ya fijado: si hay que escoger especialista, ese es el
    // siguiente dato; si no, se sigue por la fecha.
    const trasElTratamiento = (): ConversationStep => {
      if (requiereEleccionDoctor && !booking.doctor_id) return 'esperando_doctor';
      return booking.fecha ? 'esperando_horario' : 'esperando_fecha';
    };

    // Máquina de estados con guardas de validación basadas en datos reales
    switch (currentStep) {
      case 'inicio':
        if (intent === Intent.AGENDAR_CITA) {
          nextStep = booking.procedimiento_id
            ? trasElTratamiento()
            : 'esperando_tratamiento';
        }
        break;

      case 'esperando_tratamiento':
        if (booking.procedimiento_id) {
          nextStep = trasElTratamiento();
        }
        break;

      case 'esperando_doctor':
        // Se sale en cuanto elige, o si deja de haber algo que elegir.
        if (booking.doctor_id || !requiereEleccionDoctor) {
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
