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
import { AppointmentActionsTool } from '../tools/appointment-actions.tool';
import { AgentFormatter } from './agent.formatter';
import { format } from 'date-fns';

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
    private readonly actionsTool: AppointmentActionsTool,
  ) {
    this.model = new ChatOpenAI({
      openAIApiKey: this.configService.get('OPENAI_API_KEY'),
      modelName: 'gpt-4o-mini',
      temperature: 0,
      modelKwargs: {
        response_format: { type: 'json_object' }
      }
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
    const nowLocal = new Date();
    const currentDate = format(nowLocal, 'yyyy-MM-dd');
    const currentTime = format(nowLocal, 'HH:mm');
    const currentDayOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][nowLocal.getDay()];

    const bookingState = (params.metadata?.booking || {}) as {
      fecha?: string;
      hora?: string;
      procedimiento_id?: string;
      Nombre?: string;
      Apellido?: string;
      correo?: string;
      cita_id?: string;
    };

    const bookingStateBlock = `ESTADO DE AGENDAMIENTO PERSISTIDO EN BASE DE DATOS:
- Cita ID a modificar/cancelar (cita_id): ${bookingState.cita_id || 'vacío'}
- Procedimiento ID (procedimiento_id): ${bookingState.procedimiento_id || 'vacío'}
- Fecha agendada (fecha): ${bookingState.fecha || 'vacío'}
- Hora agendada (hora): ${bookingState.hora || 'vacío'}
- Nombre paciente (Nombre): ${bookingState.Nombre || 'vacío'}
- Apellido paciente (Apellido): ${bookingState.Apellido || 'vacío'}
- Correo electrónico (correo): ${bookingState.correo || 'vacío'}`;

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
        description: 'Usa esta herramienta cuando el paciente pida una cita o pregunte por horarios para un día específico.',
        schema: z.object({
          date: z.string().describe('Fecha en formato ISO (YYYY-MM-DD)'),
          treatment_id: z.string().optional().describe('ID del tratamiento para validar la duración (opcional)'),
          doctor_id: z.string().optional().describe('ID del doctor específico si el paciente prefiere uno (opcional)'),
        }),
        func: async ({ date, treatment_id, doctor_id }) => {
          try {
            const [year, month, day] = date.split('-').map(Number);
            const localDate = new Date(year, month - 1, day);
            const slots = await this.availabilityTool.getAvailableSlots(
              params.clinicId,
              localDate,
              treatment_id,
              doctor_id
            );
            if (slots.length === 0) return 'No hay disponibilidad para ese día con los criterios especificados.';
            return `Horarios disponibles (mínimo 3 sugeridos): ${slots.join(', ')}`;
          } catch (e) {
            // Política de usuario: Escalar de inmediato si falla el tool
            await this.humanTool.escalate(params.conversationId, `Error en AvailabilityTool: ${(e as Error).message}`);
            return 'ERROR_TECNICO_ESCALANDO_A_HUMANO';
          }
        },
      }),
      new DynamicStructuredTool({
        name: 'search_active_appointments',
        description: 'Usa esta herramienta para consultar si el paciente tiene citas vigentes y futuras agendadas.',
        schema: z.object({}),
        func: async () => {
          try {
            if (!params.contact?.id) {
              return 'No hay información de contacto asociada para buscar citas.';
            }
            const appointments = await this.actionsTool.searchActiveAppointments(
              params.clinicId,
              params.contact.id
            );
            if (appointments.length === 0) {
              return 'El paciente no registra citas activas programadas a futuro.';
            }
            const list = appointments
              .map(
                (app) =>
                  `- Cita ID: ${app.id} | Fecha: ${format(app.scheduledAt, 'dd/MM/yyyy')} | Hora: ${format(
                    app.scheduledAt,
                    'HH:mm'
                  )} | Especialista: ${app.doctor?.name || 'No asignado'} | Especialista ID: ${app.doctorId || 'N/A'} | Tratamiento: ${
                    app.treatment?.name || 'No asignado'
                  } | Tratamiento ID: ${app.treatmentId || 'N/A'} | Estado: ${app.status}`
              )
              .join('\n');
            return `Citas activas encontradas:\n${list}`;
          } catch (e) {
            await this.humanTool.escalate(
              params.conversationId,
              `Error en SearchActiveAppointments: ${(e as Error).message}`
            );
            return 'ERROR_TECNICO_ESCALANDO_A_HUMANO';
          }
        },
      }),
      new DynamicStructuredTool({
        name: 'cancel_appointment',
        description: 'Usa esta herramienta para cancelar una cita activa del paciente dada su ID de cita.',
        schema: z.object({
          appointment_id: z.string().describe('ID de la cita (UUID) que se desea cancelar'),
          reason: z.string().optional().describe('Razón de la cancelación explicada por el paciente'),
        }),
        func: async ({ appointment_id, reason }) => {
          try {
            await this.actionsTool.cancelAppointment(params.clinicId, appointment_id, reason);
            return 'La cita ha sido cancelada exitosamente en el sistema.';
          } catch (e) {
            await this.humanTool.escalate(
              params.conversationId,
              `Error en CancelAppointment: ${(e as Error).message}`
            );
            return 'ERROR_TECNICO_ESCALANDO_A_HUMANO';
          }
        },
      }),
      new DynamicStructuredTool({
        name: 'reschedule_appointment',
        description: 'Usa esta herramienta para reprogramar una cita activa existente a una nueva fecha y hora.',
        schema: z.object({
          appointment_id: z.string().describe('ID de la cita (UUID) que se desea reprogramar'),
          new_date: z.string().describe('Nueva fecha en formato ISO (YYYY-MM-DD)'),
          new_time: z.string().describe('Nueva hora en formato HH:MM'),
          reason: z.string().optional().describe('Razón del cambio de horario'),
        }),
        func: async ({ appointment_id, new_date, new_time, reason }) => {
          try {
            const [year, month, day] = new_date.split('-').map(Number);
            const [hour, minute] = new_time.split(':').map(Number);
            const targetDate = new Date(year, month - 1, day, hour, minute, 0, 0);

            const res = await this.actionsTool.rescheduleAppointment(
              params.clinicId,
              appointment_id,
              targetDate,
              reason
            );

            if (!res.success) {
              return `No se pudo reprogramar la cita. Motivo: ${res.message}`;
            }

            return 'La cita ha sido reprogramada exitosamente para la nueva fecha y hora.';
          } catch (e) {
            await this.humanTool.escalate(
              params.conversationId,
              `Error en RescheduleAppointment: ${(e as Error).message}`
            );
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
      include: {
        configs: true,
        schedules: true,
        policies: true,
        doctors: true,
        treatments: {
          include: {
            offers: true,
          },
        },
        knowledgeOverrides: true,
      },
    });

    const activePolicies = (clinic?.policies || []).filter(p => p.active !== false);
    const activeDoctors = (clinic?.doctors || []).filter(d => d.active !== false);
    const activeTreatments = (clinic?.treatments || []).filter(t => t.active !== false);
    const activeOverrides = (clinic?.knowledgeOverrides || []).filter(o => o.active !== false);

    // Formatear información general de la clínica
    const clinicInfo = clinic?.configs
      ? `Dirección: ${clinic.configs.address || 'No especificada'}, Teléfono: ${clinic.configs.phone || 'No especificado'}, Email: ${clinic.configs.email || 'No especificado'}`
      : 'No especificado';

    // Formatear horarios
    const schedulesInfo = clinic?.schedules?.length
      ? clinic.schedules
          .map(s => {
            const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][s.dayOfWeek] || `Día ${s.dayOfWeek}`;
            return `- ${dayName}: ${s.isOpen ? `Abierto de ${s.openTime} a ${s.closeTime}` : 'Cerrado'}`;
          })
          .join('\n')
      : '- Lunes a Sábado: Abierto de 09:00 a 18:00\n- Domingo: Cerrado';

    // Formatear doctores
    const doctorsInfo = activeDoctors.length
      ? activeDoctors.map(d => `- [ID: ${d.id}] ${d.name} (${d.title || 'Especialista'})`).join('\n')
      : 'No hay doctores registrados actualmente.';

    // Formatear tratamientos y precios
    const treatmentsInfo = activeTreatments.length
      ? activeTreatments
          .map(t => {
            const duration = t.durationAvgMin ? ` (${t.durationAvgMin} min)` : '';
            const activeOffers = (t.offers || []).filter(o => o.active !== false);
            const priceList = activeOffers.length
              ? activeOffers.map(o => `${o.label}: $${o.price}`).join(', ')
              : 'Consultar precio';
            return `- [ID: ${t.id}] ${t.name}${duration}. Precios: ${priceList}`;
          })
          .join('\n')
      : 'No hay tratamientos disponibles actualmente.';

    // Formatear políticas de la clínica
    const policiesInfo = activePolicies.length
      ? activePolicies.map(p => `- ${p.title}: ${p.description}`).join('\n')
      : 'No hay políticas específicas definidas.';

    // Formatear personalizaciones de conocimiento (RAG Overrides)
    const overridesInfo = activeOverrides.length
      ? activeOverrides
          .map(o => {
            const proc = o.customProcedure ? `\n  Procedimiento: ${o.customProcedure}` : '';
            const care = o.customPostCare?.length ? `\n  Cuidados post-tratamiento: ${o.customPostCare.join(', ')}` : '';
            const ind = o.customIndications?.length ? `\n  Indicaciones: ${o.customIndications.join(', ')}` : '';
            const notes = o.customNotes ? `\n  Notas adicionales: ${o.customNotes}` : '';
            return `- ${o.name} (${o.category}):${proc}${care}${ind}${notes}`;
          })
          .join('\n')
      : '';

    const overridesBlock = overridesInfo
      ? `\n- Cuidados e Indicaciones Especiales de Tratamientos:\n${overridesInfo}`
      : '';

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', `Eres AmalIA, el asistente experto de la clínica dental "{clinicName}".
      
      REGLAS CRÍTICAS DE COMPORTAMIENTO:
      - Responde siempre en el mismo idioma que el usuario ({detectedLanguage}).
      - Sé amable y conciso (máximo 3 oraciones en tu respuesta de texto 'reply').
      - NO alucines ni inventes horarios, disponibilidad o precios. Si necesitas información del calendario o tratamientos, usa las herramientas.
      - Si propones o encuentras un horario disponible con 'check_availability', muéstralo en la respuesta textual ('reply'), pero NO llenes el campo de salida de 'fecha' u 'hora' en tu JSON hasta que el usuario te lo confirme explícitamente.
      - SOLO puedes agendar o proveer información sobre tratamientos que estén explícitamente enumerados en la sección "Tratamientos y Precios" del contexto.
      - Si el usuario solicita agendar o pregunta sobre un tratamiento que NO aparece en la lista de "Tratamientos y Precios" (por ejemplo, solicita "ortodoncia" pero solo está "Limpieza Dental"), debes responderle amablemente que la clínica no ofrece ese tratamiento, listar los tratamientos que sí están disponibles para agendar, y dejar vacíos los campos de "procedimiento_id", "fecha" y "hora" del JSON, sin intentar agendar.
      - NO utilices la especialidad o título de un doctor (ej: que un doctor sea "Ortodoncista") para deducir que un tratamiento está disponible si este no figura explícitamente en el listado de tratamientos. El tratamiento debe existir obligatoriamente en el listado de "Tratamientos y Precios" de la clínica para poder ser agendado.
      
      📆 REGLA DE ORO PARA FECHAS RELATIVAS:
      - Si el usuario menciona un día relativo ("lunes", "mañana", "próxima semana"), calcula la fecha exacta en formato DD/MM/YYYY utilizando la FECHA ACTUAL DEL SISTEMA que se te da.
      - Tu única respuesta en 'reply' debe ser pedir confirmación explícita (ej. "Perfecto, ¿te refieres al 15/06/2026?"). Tienes estrictamente prohibido buscar disponibilidad para ese día relativo con la herramienta o avanzar de paso hasta que el usuario confirme con un "sí" o similar.

      🔄 REGLAS PARA GESTIÓN DE CITAS EXISTENTES (CANCELACIÓN / REPROGRAMACIÓN):
      - Si el paciente desea cancelar o cambiar una cita, invoca la herramienta \`search_active_appointments\` primero para conocer qué citas vigentes tiene.
      - Al invocar \`search_active_appointments\`, guarda el ID de la cita (UUID) en el campo "cita_id" de tu respuesta JSON final. Esto es obligatorio para que el ID persista en el estado y lo tengas disponible en el siguiente turno.
      - Si el paciente tiene múltiples citas, muéstraselas y pídele que elija cuál desea cancelar o modificar.
      - Para cancelar, invoca \`cancel_appointment\` pasando el UUID de la cita (que debe coincidir con el "cita_id" del estado persistido).
      - Para reprogramar, verifica primero la disponibilidad del nuevo horario usando \`check_availability\` (pasa \`treatment_id\` y \`doctor_id\` si están disponibles). Si el horario está disponible, invoca \`reschedule_appointment\` con el UUID de la cita (que debe coincidir con el "cita_id" del estado) y la nueva fecha/hora.
      
      CONTEXTO DE CLÍNICA:
      - Información General y Contacto: {clinicInfo}
      - Horarios de Atención:
      {schedules}
      - Doctores Disponibles:
      {doctors}
      - Tratamientos y Precios:
      {treatments}
      - Políticas y Preguntas Frecuentes (FAQs):
      {policies}
      {overridesBlock}
      
      CONTEXTO TEMPORAL ACTUAL:
      - Fecha Actual del Sistema: {currentDate}
      - Hora Actual del Sistema: {currentTime}
      - Día de la Semana: {currentDayOfWeek}

      {bookingStateBlock}

      ESTADO ACTUAL DEL FLUJO: {currentStep}
      INTENCIÓN DETECTADA: {intent}

      FORMATO OBLIGATORIO DE RESPUESTA (SIEMPRE JSON):
      Debes responder ÚNICAMENTE con un objeto JSON válido que contenga la siguiente estructura. Está prohibido escribir cualquier texto de markdown o natural fuera de este JSON:
      {{
        "reply": "Tu respuesta humana redactada de forma natural al paciente aquí (en su idioma)...",
        "action": "agendar | derivar_humano | ...",
        "fecha": "DD/MM/YYYY o vacío",
        "hora": "HH:MM o vacío",
        "procedimiento_id": "El ID del tratamiento (ej: el UUID que aparece entre brackets como [ID: ...]) o vacío",
        "cita_id": "El ID de la cita (UUID) obtenido tras buscar citas activas si deseas reprogramar o cancelar, o vacío",
        "Nombre": "Nombre del paciente o vacío",
        "Apellido": "Apellido del paciente o vacío",
        "correo": "correo del paciente o vacío",
        "paso": "el_paso_actual (debe coincidir con ESTADO ACTUAL DEL FLUJO o avanzar según las reglas)"
      }}
      
      * Preserva siempre los valores del ESTADO DE AGENDAMIENTO PERSISTIDO EN BASE DE DATOS. Si un campo ya tiene un valor en el estado, cópialo exactamente igual en tu respuesta JSON; no lo dejes vacío o lo borrarás de la base de datos.
      `],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const agent = await createOpenAIFunctionsAgent({
      llm: this.model,
      tools: tools as any[],
      prompt,
    });

    const executor = new AgentExecutor({
      agent,
      tools: tools as any[],
      verbose: true,
    });

    // 5. Ejecutar Agente
    const response = await executor.invoke({
      input: params.userInput,
      chat_history: AgentFormatter.formatHistory(params.history, params.userInput),
      clinicName: (clinic as any).name,
      detectedLanguage: 'el mismo idioma del usuario',
      clinicInfo,
      schedules: schedulesInfo,
      doctors: doctorsInfo,
      treatments: treatmentsInfo,
      policies: policiesInfo,
      overridesBlock,
      currentStep: params.currentStep,
      intent: classification.intent,
      currentDate,
      currentTime,
      currentDayOfWeek,
      bookingStateBlock,
    });

    let replyText = response.output;
    let nextStepText = params.currentStep;
    let parsedJson: any = null;

    try {
      const cleanedOutput = response.output.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedJson = JSON.parse(cleanedOutput);
      
      replyText = parsedJson.reply || response.output;
      nextStepText = parsedJson.paso || params.currentStep;
      
      // Actualizar metadatos de agendamiento
      const existingMetadata = (params.metadata || {}) as any;
      const updatedBooking = {
        procedimiento_id: parsedJson.procedimiento_id || existingMetadata.booking?.procedimiento_id || '',
        cita_id: parsedJson.cita_id || existingMetadata.booking?.cita_id || '',
        fecha: parsedJson.fecha || existingMetadata.booking?.fecha || '',
        hora: parsedJson.hora || existingMetadata.booking?.hora || '',
        Nombre: parsedJson.Nombre || existingMetadata.booking?.Nombre || '',
        Apellido: parsedJson.Apellido || existingMetadata.booking?.Apellido || '',
        correo: parsedJson.correo || existingMetadata.booking?.correo || '',
      };
      
      await this.prisma.conversation.update({
        where: { id: params.conversationId },
        data: {
          metadata: {
            ...existingMetadata,
            booking: updatedBooking,
          }
        }
      });
      
    } catch (e) {
      this.logger.warn(`No se pudo parsear el output de la IA como JSON estructurado: ${response.output}`);
    }

    // 6. Post-procesamiento: Actualizar Estado si no hubo escalada
    if (response.output !== 'ERROR_TECNICO_ESCALANDO_A_HUMANO') {
      const existingMetadataAfter = await this.prisma.conversation.findUnique({
        where: { id: params.conversationId }
      });
      const currentBooking = (existingMetadataAfter?.metadata as any)?.booking || {};

      await this.stateManager.calculateNextStep(
        params.conversationId,
        params.currentStep as ConversationStep,
        classification.intent,
        classification.confidence,
        currentBooking
      );
    }

    return { text: replyText };
  }
}
