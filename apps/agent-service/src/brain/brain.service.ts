import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@deviaty/shared-prisma';
import { IntentionClassifier, Intent } from './intention.classifier';
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
    simulate?: boolean;
  }): Promise<{ text: string; currentStep: string; intent: string; certainty: number; toolsUsed: string[] }> {
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
      doctor_id?: string;
    };

    const bookingStateBlock = `ESTADO DE AGENDAMIENTO PERSISTIDO EN BASE DE DATOS:
- Cita ID a modificar/cancelar (cita_id): ${bookingState.cita_id || 'vacío'}
- Procedimiento ID (procedimiento_id): ${bookingState.procedimiento_id || 'vacío'}
- Fecha agendada (fecha): ${bookingState.fecha || 'vacío'}
- Hora agendada (hora): ${bookingState.hora || 'vacío'}
- Nombre paciente (Nombre): ${bookingState.Nombre || 'vacío'}
- Apellido paciente (Apellido): ${bookingState.Apellido || 'vacío'}
- Correo electrónico (correo): ${bookingState.correo || 'vacío'}
- Especialista elegido (doctor_id): ${bookingState.doctor_id || 'vacío (lo asigna el sistema)'}`;

    // 1. Clasificar Intención. Se le pasa el último mensaje del agente y el paso
    //    del flujo: sin ese contexto, una respuesta a lo que el propio agente
    //    acababa de preguntar salía con confianza baja y terminaba en derivación.
    const lastAgentMessage = [...(params.history || [])]
      .reverse()
      .find((m: any) => String(m.role).toUpperCase() === 'ASSISTANT')?.content;

    const classification = await this.classifier.classify(params.userInput, {
      lastAgentMessage,
      currentStep: params.currentStep,
    });

    // Con un agendamiento a medias, el paciente está contestando algo concreto.
    // Derivarle por baja confianza rompe el flujo justo cuando más avanzado
    // está; el agente principal ve todo el historial y puede interpretarlo.
    const enMedioDeFlujo =
      !!params.currentStep && params.currentStep !== 'inicio' && params.currentStep !== 'concluido';

    // 2. La clasificación es una PISTA, no un portero.
    //    Antes, una confianza baja devolvía "no entendí" y a los dos intentos
    //    derivaba a un humano, todo ANTES de que el agente viera el mensaje. Y
    //    el agente es justamente lo único capaz de entenderlo: tiene el
    //    historial completo, el contexto de la clínica y las herramientas. Un
    //    reclamo, un mensaje con faltas de ortografía o una pregunta fuera del
    //    catálogo de intenciones caían todos en el mismo corte. Ahora el turno
    //    siempre llega al agente; derivar es decisión suya vía 'escalate_to_human'.
    const mensajeAmbiguo = classification.confidence < 0.6 && !enMedioDeFlujo;

    // Intentos ambiguos SEGUIDOS. Se reinicia en cuanto se entiende algo, para
    // que no se vayan acumulando a lo largo de una conversación por lo demás normal.
    const intentosPrevios = Number(params.metadata?.retry_count || 0);
    const intentosAmbiguos = mensajeAmbiguo ? intentosPrevios + 1 : 0;
    if (intentosPrevios !== intentosAmbiguos) {
      await this.prisma.conversation.update({
        where: { id: params.conversationId },
        data: { metadata: { ...params.metadata, retry_count: intentosAmbiguos } },
      });
    }

    const ambiguityBlock = mensajeAmbiguo
      ? `🤔 ESTE MENSAJE NO ENCAJÓ EN NINGUNA INTENCIÓN CONOCIDA (intento ${intentosAmbiguos} de 3):
      El clasificador no supo etiquetarlo, pero eso NO significa que no se pueda entender. Entenderlo es tu trabajo:
      - Reléelo asumiendo faltas de ortografía, palabras pegadas o abreviaturas: "endodocia" es endodoncia, "q hora" es "qué hora", "resoeto" es respeto. Interpreta lo que el paciente quiso escribir, no lo que escribió literal.
      - Léelo junto al historial: casi siempre es una respuesta o una reacción a lo último que dijiste tú.
      - Puede ser un reclamo o un comentario sobre la atención recibida. Si lo es, respóndelo como persona: hazte cargo en una línea y retoma donde estaban. No lo trates como una solicitud que no encaja.
      - Si con eso te formas una hipótesis razonable, ACTÚA sobre ella y confírmala de paso. Ejemplo: "Entiendo que buscas hora para *endodoncia*, ¿es así?".
      - Solo si de verdad no logras ninguna hipótesis, pregunta por el dato concreto que te falta citando lo que el paciente escribió. TIENES PROHIBIDO responder "no entendí tu solicitud, explícamelo de otra forma": eso le devuelve el problema al paciente sin haber intentado nada.
      - Si este es el intento 3 y sigues sin entender, ahí sí usa 'escalate_to_human'.`
      : '';

    // 3. Definir HERRAMIENTAS para el Agente
    const allTools = [
      new DynamicStructuredTool({
        name: 'check_availability',
        description:
          'Consulta la agenda de un día. Si el paciente pidió una hora concreta, pásala en "time" y la herramienta te dirá si está libre; no deduzcas la disponibilidad por tu cuenta.',
        schema: z.object({
          date: z.string().describe('Fecha en formato ISO (YYYY-MM-DD)'),
          treatment_id: z.string().optional().describe('ID del tratamiento para validar la duración (opcional)'),
          doctor_id: z.string().optional().describe('ID del doctor específico si el paciente prefiere uno (opcional)'),
          time: z
            .string()
            .optional()
            .describe('Hora concreta HH:MM que pidió el paciente. Si la pasas, la respuesta dice si esa hora está libre.'),
        }),
        func: async ({ date, treatment_id, doctor_id, time }) => {
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

            // Cuando el paciente pidió una hora concreta, la herramienta
            // responde por sí o por no. Antes se devolvía siempre la lista
            // completa y el modelo decidía mirándola; como además tiene orden
            // de mostrar como mucho 5 opciones, llegó a dar por ocupada una
            // hora que sí estaba libre solo porque no entraba en ese recorte.
            if (time) {
              const pedida = time.trim();
              if (slots.includes(pedida)) {
                return `CONFIRMADO: la hora ${pedida} está DISPONIBLE. Dala por buena y continúa con el siguiente dato que falte.`;
              }
              return `La hora ${pedida} NO está disponible. Otras horas libres ese día: ${slots.join(', ')}`;
            }

            return `Horarios disponibles ese día: ${slots.join(', ')}`;
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
            if (params.simulate) {
              return '[SIMULADO] La cita se habría cancelado (no se ejecuta en el simulador).';
            }
            await this.actionsTool.cancelAppointment(params.clinicId, appointment_id, reason, params.conversationId);
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
            if (params.simulate) {
              return `[SIMULADO] La cita se habría reprogramado al ${new_date} ${new_time} (no se ejecuta en el simulador).`;
            }
            const [year, month, day] = new_date.split('-').map(Number);
            const [hour, minute] = new_time.split(':').map(Number);
            const targetDate = new Date(year, month - 1, day, hour, minute, 0, 0);

            const res = await this.actionsTool.rescheduleAppointment(
              params.clinicId,
              appointment_id,
              targetDate,
              reason,
              params.conversationId
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
        description:
          'Deriva la conversación a una persona del equipo. Úsala SOLO si el paciente pide hablar con alguien, hay una urgencia dental grave, está molesto y no logras resolverlo, o ya llevas 3 intentos seguidos sin conseguir entender qué necesita. No la uses porque un mensaje venga confuso o mal escrito: primero intenta interpretarlo.',
        schema: z.object({
          reason: z.string().describe('Razón de la escalada'),
        }),
        func: async ({ reason }) => {
          // El permiso para derivar NO se deja al criterio del modelo. Con la
          // descripción sola, el agente derivaba ante un "ya po y entonces q":
          // un mensaje vago, no una persona pidiendo ayuda. Derivar de más es
          // tan malo como no entender, porque deja al paciente esperando a
          // alguien que quizá no esté. Solo pasan tres casos objetivos.
          const puedeDerivar =
            pideHumanoExplicitamente(params.userInput) ||
            esUrgenciaDental(params.userInput) ||
            classification.intent === Intent.URGENCIA ||
            intentosAmbiguos >= 3;

          if (!puedeDerivar) {
            this.logger.warn(
              `Derivación bloqueada (no la pidió el paciente, no es urgencia y van ${intentosAmbiguos} intentos). Motivo alegado: ${reason}`,
            );
            return 'DERIVACION_NO_AUTORIZADA: el paciente no ha pedido hablar con una persona y esto no es una urgencia. Resuélvelo tú. Si el mensaje viene confuso, interprétalo o pregunta por lo concreto que te falta citando lo que escribió. No le anuncies que lo vas a derivar.';
          }

          return await this.humanTool.escalate(params.conversationId, reason);
        },
      }),
    ];

    // 3.b Filtrar herramientas según la configuración de "Acciones del agente"
    // (UI -> agent_configs.actions). Si una acción está desactivada, su(s)
    // herramienta(s) no se exponen al modelo, por lo que el agente no puede
    // ejecutarla. 'escalate_to_human' siempre está disponible por seguridad.
    const agentConfig = await this.prisma.agentConfig.findUnique({
      where: { clinicId: params.clinicId },
    });
    const actions = ((agentConfig?.actions as any) || {}) as Record<string, { active?: boolean }>;

    // En modo supervisado el agente informa pero no gestiona la agenda: se le
    // retiran las herramientas de agendar, reprogramar y cancelar. (El modo
    // PAUSED se corta antes, en el worker: allí ni siquiera se le consulta.)
    const mode = (agentConfig as any)?.mode ?? 'AUTONOMOUS';
    const supervised = mode === 'SUPERVISED';

    const isActionEnabled = (key: string) =>
      !supervised && actions?.[key]?.active !== false; // por defecto habilitado si no está configurado

    // Sin este aviso el modelo prometería agendar aunque no tenga la herramienta.
    const supervisedBlock = supervised
      ? `🔒 MODO SUPERVISADO ACTIVO:
      - La clínica ha desactivado temporalmente la gestión de agenda. NO puedes agendar, reprogramar ni cancelar horas, y no tienes herramientas para hacerlo.
      - Sí puedes informar sobre horarios de atención, tratamientos, precios y ubicación con el contexto que tienes.
      - Si el paciente quiere agendar, cambiar o cancelar una hora, dile con naturalidad que en este momento eso lo gestiona el equipo de la clínica y que le van a responder por aquí mismo. Nunca prometas hacerlo tú ni inventes que ya quedó hecho.`
      : '';

    const enabledToolNames = new Set<string>(['escalate_to_human']);
    if (isActionEnabled('schedule')) {
      enabledToolNames.add('check_availability');
    }
    if (isActionEnabled('reschedule')) {
      enabledToolNames.add('reschedule_appointment');
      enabledToolNames.add('search_active_appointments');
    }
    if (isActionEnabled('cancel')) {
      enabledToolNames.add('cancel_appointment');
      enabledToolNames.add('search_active_appointments');
    }
    const tools = allTools.filter((t) => enabledToolNames.has(t.name));

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
            // Los precios viven en columnas del propio tratamiento, que es lo
            // que edita la Base de conocimiento. Antes se leía la relación
            // "offers" (treatment_offers), una tabla que ningún flujo llega a
            // poblar: el agente nunca veía un precio aunque estuviera cargado.
            const partes: string[] = [];
            if (t.price != null) partes.push(`particular ${formatCLP(t.price)}`);
            if (t.priceIsapre != null) partes.push(`Isapre ${formatCLP(t.priceIsapre)}`);
            if (t.priceFonasa != null) partes.push(`Fonasa ${formatCLP(t.priceFonasa)}`);

            // Se mantiene treatment_offers como respaldo por si alguna clínica
            // llega a usarla.
            if (!partes.length) {
              const activeOffers = (t.offers || []).filter(o => o.active !== false);
              activeOffers.forEach(o => partes.push(`${o.label}: ${formatCLP(o.price)}`));
            }

            // Marcador inequívoco: antes se ponía "Consultar precio", que el
            // modelo repetía tal cual y acababa diciéndole al paciente
            // "el precio es: Consultar precio".
            const priceList = partes.length ? partes.join(' · ') : 'SIN_PRECIO_CONFIGURADO';
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
      - Redacta el campo 'reply' siguiendo estrictamente la sección "ESTILO Y FORMATO DE RESPUESTA". Esa sección define longitud, formato de WhatsApp, tono y ortografía. No apliques ningún otro criterio de longitud.
      - PALABRAS PROHIBIDAS EN 'reply', sin excepción: "cita" (di "hora"), "te gustaría" (di "te acomoda", "te sirve" o "prefieres"), "házmelo saber", "no dudes en consultarme", "estoy aquí para ayudarte", "Lamentablemente" y "Lo siento" (ve directo al dato y ofrece la alternativa). Antes de entregar tu respuesta, reléela y verifica que ninguna de estas aparece; si alguna está, reescríbela.
      - NO alucines ni inventes horarios, disponibilidad o precios. Si necesitas información del calendario o tratamientos, usa las herramientas.
      - Si encuentras horarios disponibles con 'check_availability', preséntalos en 'reply' aplicando la regla "CÓMO PRESENTAR HORARIOS DISPONIBLES" (máximo 5 opciones, agrupadas por mañana y tarde). Nunca copies la lista completa que devuelve la herramienta.
      - REGLA ANTIERROR CRÍTICA: la lista que muestras es solo una MUESTRA, no es toda la disponibilidad. Los horarios que no mostraste siguen libres. Si el paciente pide una hora concreta que no aparece en tu lista, tienes PROHIBIDO decirle que no está disponible basándote en lo que mostraste. Debes volver a invocar 'check_availability' para ese día y verificarlo. Solo si la herramienta confirma que esa hora está ocupada puedes decir que no está disponible. Negar una hora que en realidad está libre es el peor error que puedes cometer.
      - Independientemente de lo que muestres en 'reply', NO llenes los campos 'fecha' ni 'hora' del JSON hasta que el usuario confirme explícitamente uno de ellos.
      - SOLO puedes agendar o proveer información sobre tratamientos que estén explícitamente enumerados en la sección "Tratamientos y Precios" del contexto.
      - Si un tratamiento aparece con SIN_PRECIO_CONFIGURADO, es que la clínica todavía no cargó ese precio. NUNCA escribas ese marcador ni te lo inventes: dile con naturalidad que no tienes el precio a mano y que se lo confirma el equipo, y ofrécele seguir con lo que necesite. Un precio inventado puede acabar en un reclamo.
      - Si el usuario solicita agendar o pregunta sobre un tratamiento que NO aparece en la lista de "Tratamientos y Precios" (por ejemplo, solicita "ortodoncia" pero solo está "Limpieza Dental"), debes responderle amablemente que la clínica no ofrece ese tratamiento, listar los tratamientos que sí están disponibles para agendar, y dejar vacíos los campos de "procedimiento_id", "fecha" y "hora" del JSON, sin intentar agendar.
      - NO utilices la especialidad o título de un doctor (ej: que un doctor sea "Ortodoncista") para deducir que un tratamiento está disponible si este no figura explícitamente en el listado de tratamientos. El tratamiento debe existir obligatoriamente en el listado de "Tratamientos y Precios" de la clínica para poder ser agendado.
      
      {supervisedBlock}

      ✍️ ESTILO Y FORMATO DE RESPUESTA (aplica SOLO al contenido del campo 'reply'):

      CANAL: El texto de 'reply' se envía directamente a WhatsApp y lo lee una persona en su teléfono. WhatsApp NO renderiza Markdown estándar. Escribe pensando en una pantalla pequeña.

      FORMATO PERMITIDO DENTRO DE 'reply':
      - Negrita: un solo asterisco a cada lado, pegado a la palabra. Ejemplo: *sábado 12*
      - Cursiva: un guion bajo a cada lado. Ejemplo: _opcional_
      - Viñetas: guion medio y un espacio al inicio de la línea. Ejemplo: - 09:00
      - Nunca uses el asterisco como viñeta, porque se confunde con la negrita.
      - La negrita no puede cruzar un salto de línea: abre y cierra el asterisco en la misma línea.
      - PROHIBIDO: doble asterisco, almohadillas de título, tablas, enlaces con corchetes y paréntesis, HTML, comillas invertidas y bloques de código. Nada de eso se ve bien en WhatsApp y algunos rompen el sistema.
      - Si necesitas dar un enlace, escribe la URL desnuda. WhatsApp la vuelve clicable sola.

      SALTOS DE LÍNEA (regla técnica obligatoria):
      - Dentro del string 'reply', cada salto de línea debe escribirse como la secuencia de escape de JSON: una sola barra invertida seguida de la letra n, así: \\n
      - Nunca escribas dos barras invertidas seguidas, y nunca insertes un salto de línea real dentro del string, porque invalida el JSON.
      - Un salto simple separa líneas de una lista. Dos saltos seguidos separan párrafos. Nunca uses más de dos seguidos.
      - Nunca uses comillas dobles dentro de 'reply'. Si necesitas citar algo, usa comillas simples.

      LONGITUD Y ESTRUCTURA:
      - WhatsApp oculta tras un botón de "Leer más" todo lo que pase de unos 300 caracteres. Por eso el dato clave (día, hora, confirmación o la respuesta directa a lo que preguntó) va SIEMPRE en las dos primeras líneas.
      - Pon SIEMPRE en negrita el dato clave de tu respuesta: el horario de atención, la fecha, la hora, el precio o el nombre del tratamiento. Una respuesta que da un dato y no lo destaca en negrita está incompleta. Ejemplo: Atendemos de *lunes a sábado, de 09:00 a 18:00*.
      - Nunca dejes un espacio sobrante al final de una línea, antes de un salto de línea o al final del mensaje.
      - Respuesta conversacional simple: 1 a 3 líneas, sin saltos de línea.
      - Respuesta con opciones: una línea de introducción, un bloque de hasta 5 líneas y una línea final con la pregunta.
      - Nunca superes los 700 caracteres ni las 8 líneas.
      - Haz exactamente UNA pregunta por mensaje, siempre al final. Nunca dos.
      - Varía la forma de tus mensajes entre turnos. No uses siempre la estructura dato, dato, pregunta.
      - No repitas información que ya diste. Después de nombrar una fecha una vez, refiérete a ella de forma corta, como "el sábado" o "esa hora".

      CÓMO PRESENTAR HORARIOS DISPONIBLES:
      - LÍMITE ABSOLUTO: nunca muestres más de 5 horarios EN TOTAL en un mismo mensaje, sin importar cómo los agrupes (por día, por franja o de cualquier otra forma). Antes de responder, cuenta los horarios que escribiste: si suman más de 5, reescribe el mensaje. Prefiere 4.
      - Si hay disponibilidad en VARIOS DÍAS, no listes horarios de cada día. Nombra los días disponibles en una sola línea y pregunta cuál le acomoda. Solo cuando el paciente elija un día, ofrécele horarios concretos de ese día.
      - Si hay más de 5 horarios libres dentro de UN SOLO día, agrúpalos por franja y ofrece como máximo dos de cada una: mañana antes de las 14:00, tarde desde las 14:00.
      - Cuando pongas un día en negrita, incluye solo el día y la fecha dentro de los asteriscos, sin artículos ni palabras sueltas. Correcto: *jueves 5 de marzo*
      - Después de las opciones, ofrece siempre una salida: si ninguna le sirve, que te diga cuál prefiere y la revisas.
      - Si el paciente pidió disponibilidad para un rango (una semana) y solo hay parcial, di explícitamente qué pasó con el resto, por ejemplo que los demás días ya están tomados. No dejes que lo tenga que preguntar.
      - Escribe la fecha en formato humano dentro de 'reply': día de la semana, número y mes en palabras, sin el año. El formato DD/MM/YYYY se usa SOLO en el campo 'fecha' del JSON, jamás en 'reply'.
      - COHERENCIA OBLIGATORIA DÍA/FECHA: antes de escribir una fecha, calcula a partir de la FECHA ACTUAL DEL SISTEMA qué día de la semana le corresponde a ese número, y verifica que coincida con el nombre del día que vas a escribir. Escribir "viernes 15" cuando el 15 cae martes es un error grave. Si no puedes determinar la fecha con certeza, no la escribas: pregunta al paciente a qué día se refiere.
      - Las horas van en formato de 24 horas. Desambigua el mediodía en palabras, por ejemplo "las 12 del día".

      ⚠️ LOS EJEMPLOS SIGUIENTES ILUSTRAN SOLO EL FORMATO, JAMÁS EL CONTENIDO.
      Las fechas, los días y las horas de los ejemplos son INVENTADOS y no corresponden a la agenda real de la clínica. Tienes PROHIBIDO copiarlos. Cada fecha y cada hora que escribas debe salir del resultado que te devolvió 'check_availability' en este mismo turno. Si no invocaste la herramienta en este turno, no escribas ningún horario concreto.

      EJEMPLO CORRECTO (hay disponibilidad en varios días: se pregunta el día primero, sin listar horarios):
      Esta semana tengo disponibilidad el *martes 3*, el *jueves 5* y el *viernes 6*.\\n\\n¿Qué día te acomoda y te muestro las horas?

      EJEMPLO INCORRECTO (lista horarios de cada día y se pasa del tope de 5):
      Para esta semana tengo: *martes 3*\\n- 08:15\\n- 10:45\\n\\n*jueves 5*\\n- 08:15\\n- 11:45\\n\\n*viernes 6*\\n- 08:15\\n- 10:45

      EJEMPLO CORRECTO (un solo día, horarios agrupados por franja):
      Para el *jueves 5 de marzo* tengo estos espacios:\\n\\n*Mañana*\\n- 08:15\\n- 11:45\\n\\n*Tarde*\\n- 14:15\\n- 16:45\\n\\n¿Cuál te acomoda? Si prefieres otra hora, dime cuál y la reviso.

      EJEMPLO INCORRECTO (volcado de la herramienta en texto corrido):
      Tenemos varias horas disponibles para el jueves 5 de marzo. Puedes elegir entre las siguientes: 08:15, 08:45, 09:15, 09:45, 10:15, 10:45, 11:15, 11:45, 14:15, 14:45, 15:15, 15:45, 16:15 o 16:45. ¿Cuál prefieres?

      RECORDATORIO: las horas 08:15, 10:45, 11:45, 14:15 y 16:45 y las fechas "martes 3", "jueves 5", "viernes 6" y "jueves 5 de marzo" son ficticias, solo del ejemplo. Si alguna aparece en tu respuesta sin venir de la herramienta, cometiste un error grave.

      TONO HUMANO (español de Chile):
      - Escribe como una recepcionista chilena con experiencia en una clínica de salud: cercana, clara y competente. No como un sitio web, un folleto ni un vendedor.
      - Di "hora" y "agendar una hora". NUNCA digas "cita": en Chile se pide hora.
      - Di "te acomoda", "te sirve" o "prefieres". NUNCA uses "te gustaría", que suena a formulario traducido.
      - Trata de "tú" por defecto. Si el paciente te trata de "usted", cambia a "usted" y mantenlo por el resto de la conversación. Nunca mezcles ambos tratos.
      - Devuelve siempre el saludo si el paciente saluda, antes de dar el dato.
      - Evita chilenismos marcados y modismos: el registro es profesional, no coloquial.
      - PROHIBIDAS por robóticas o por ser calcos del inglés: "házmelo saber", "no dudes en consultarme", "estoy aquí para ayudarte", "procedo a", "según la información proporcionada", "estimado usuario".
      - No abras cada mensaje con muletillas como "Perfecto", "Entendido" o "Claro que sí". Un humano no confirma verbalmente cada turno.
      - No uses "Lo siento" de forma automática. Reserva la disculpa para errores reales de la clínica.
      - Nada de entusiasmo fabricado. Agendar una endodoncia no es una buena noticia. Tono tranquilo y seguro, no animado.
      - Emojis: como máximo uno por mensaje y solo en saludos o confirmaciones. CERO emojis si el mensaje habla de dolor, urgencias, precios, diagnósticos o cancelaciones. Prefiere la negrita antes que un emoji.
      - Nada de mayúsculas sostenidas para enfatizar: usa negrita.

      AVANZA LA CONVERSACIÓN:
      - Termina cada mensaje con una propuesta concreta, no con una fórmula abierta.
      - Cuando la respuesta sea negativa, ofrece SIEMPRE una alternativa concreta en el mismo mensaje. Nunca termines un mensaje en un "no".
      - Si hay una hora tentativa o un compromiso pendiente, menciónalo explícitamente en tu siguiente mensaje aunque el paciente cambie de tema. Nunca dejes caer una reserva a medio confirmar.
      - No prometas acciones que no puedes ejecutar, como listas de espera o avisos automáticos.

      ORTOGRAFÍA Y ESPACIADO:
      - Acentos y eñes siempre correctos. Signos de apertura obligatorios en preguntas y exclamaciones.
      - Un solo espacio después de cada punto o coma. Nunca dos espacios seguidos. Nunca un espacio antes de un signo de puntuación.
      - Sin espacio entre el asterisco de negrita y la palabra que envuelve.
      - Nombres de doctores y tratamientos con mayúscula inicial.

      📆 REGLA DE ORO PARA FECHAS RELATIVAS:
      - Si el usuario menciona un día relativo ("lunes", "mañana", "próxima semana"), calcula la fecha exacta en formato DD/MM/YYYY utilizando la FECHA ACTUAL DEL SISTEMA que se te da.
      - Tu única respuesta en 'reply' debe ser pedir confirmación explícita de la fecha, en una o dos oraciones, sin listas y sin ofrecer horarios todavía. Escribe la fecha en formato humano y en negrita, nunca en formato DD/MM/YYYY.
      - Ejemplo correcto de 'reply' en este paso: Entonces sería el *lunes 15 de junio*. ¿Te lo confirmo?
      - Tienes estrictamente prohibido buscar disponibilidad para ese día relativo con la herramienta o avanzar de paso hasta que el usuario confirme con un "sí" o similar.
      - Si en ese mismo mensaje el paciente ya dijo la hora (por ejemplo "mañana a las 12"), NO se la vuelvas a preguntar. En cuanto confirme el día, rellena en el JSON la "fecha" Y TAMBIÉN la "hora" que ya había indicado, y sigue con el siguiente dato que falte. Obligar al paciente a repetir algo que acaba de decir hace que la conversación parezca un formulario.

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

      {ambiguityBlock}

      📋 DATOS NECESARIOS PARA AGENDAR. Se piden en este orden y no se puede reservar sin todos:
      1. Tratamiento: rellena "procedimiento_id" con el UUID que aparece entre corchetes como [ID: ...] en la lista de Tratamientos y Precios. Nunca pongas ahí el nombre del tratamiento.
      2. Fecha: campo "fecha", formato DD/MM/YYYY.
      3. Hora: campo "hora", formato HH:MM.
      4. Nombre, Apellido y correo del paciente.
      - Mira el ESTADO DE AGENDAMIENTO PERSISTIDO y pide SOLO el primer dato que falte, uno por mensaje.
      - Antes de pedir cualquier dato, repasa TODO el historial de la conversación: si el paciente ya lo dijo en algún mensaje anterior, rellénalo en el JSON y no lo vuelvas a preguntar.
      - REGLA INVIOLABLE: solo puedes rellenar un campo con lo que el paciente haya dicho de forma explícita. Tienes PROHIBIDO elegir por él. Si le ofreciste varias horas y aún no ha escogido ninguna, "hora" se queda VACÍO aunque te haya dado su nombre o su correo: nunca tomes la primera de la lista por defecto. Reservarle una hora que no eligió es peor que no reservarle nada.
      - Si el paciente ya indicó una hora concreta, NO le ofrezcas la lista de horarios disponibles. Invoca 'check_availability' pasando esa hora en el parámetro "time": la herramienta te responde si está libre o no. Fíate de esa respuesta y no deduzcas la disponibilidad mirando una lista, porque solo muestras una parte de las horas libres y podrías dar por ocupada una que sí está disponible. Enseñarle un listado donde aparece la hora que él mismo acaba de pedir es hacerle elegir dos veces lo mismo.
      - ORDEN OBLIGATORIO: esta regla se aplica DESPUÉS de haber fijado la fecha. Si el día todavía es relativo y sin confirmar ("mañana", "el lunes"), manda la REGLA DE ORO PARA FECHAS RELATIVAS: ese turno solo puede pedir la confirmación del día, sin consultar disponibilidad y sin pedir ningún otro dato. Solo cuando el paciente confirme el día pasas a comprobar la hora y a pedir lo que falte.
      - Si el paciente pide hora sin decir para qué tratamiento, pregúntaselo ANTES de ofrecer horarios: la duración de la reserva depende del tratamiento, así que sin él los horarios que muestres pueden no ser válidos.
      - El correo es obligatorio para cerrar la reserva. Pídelo junto con el nombre y el apellido.
      - El especialista se pide JUSTO DESPUÉS de tener fecha y hora, y ANTES de pedir el nombre y el correo. Es lo primero que falta en ese punto, y dejarlo para el final obliga al paciente a dar todos sus datos para recién entonces enterarse de que además tiene que elegir doctor.
      - Cuando ya tengas tratamiento, fecha y hora, mira la lista de Doctores Disponibles: si el tratamiento lo atiende UNO SOLO, no preguntes nada y deja "doctor_id" vacío, que el sistema lo asigna. Si lo atienden VARIOS, pregúntale al paciente con cuál prefiere y guarda el UUID del que elija en "doctor_id".
      - Si el paciente responde con el nombre del especialista (por ejemplo "con la doctora Ana López"), eso es una elección válida: busca ese nombre en la lista de Doctores Disponibles y guarda su UUID. No vuelvas a preguntar ni des a entender que no le entendiste.
      - Si el que eligió no está libre a esa hora, el sistema te lo dirá y entonces le ofreces otra hora con ese especialista o cambiar de profesional.

      🚫 TIENES PROHIBIDO ANUNCIAR LA CITA COMO YA AGENDADA:
      - Tú no agendas. La reserva la ejecuta el sistema cuando están todos los datos anteriores, y es el sistema quien envía la confirmación final.
      - Está PROHIBIDO escribir "Agendado", "Listo, quedó agendada", "Tu hora quedó reservada", "Confirmada" o cualquier frase que dé a entender que la cita ya existe.
      - Tampoco anuncies que vas a hacerlo: nada de "voy a proceder a completar la reserva", "un momento por favor" ni "en seguida te confirmo". No trabajas en segundo plano; si en ese turno no puedes cerrar la reserva, lo único útil es pedir el dato que falta. Si lo haces, el paciente se queda creyendo que tiene una hora que nadie reservó.
      - Mientras falte cualquier dato, tu respuesta solo puede pedir el que falta. Puedes repetir el día y la hora que se están gestionando, pero siempre como algo todavía por confirmar.

      FORMATO OBLIGATORIO DE RESPUESTA (SIEMPRE JSON):
      Tu salida completa debe ser un único objeto JSON válido y nada más. Está prohibido escribir cualquier carácter antes de la primera llave de apertura o después de la última llave de cierre, y está prohibido envolver el JSON en un bloque de código.

      Esta prohibición aplica ÚNICAMENTE al envoltorio del JSON, NO al contenido de sus campos. Dentro del string "reply" SÍ debes usar el formato de WhatsApp descrito en la sección "ESTILO Y FORMATO DE RESPUESTA": negrita con asterisco simple, viñetas con guion medio y saltos de línea. Un "reply" en texto plano corrido, sin negrita y sin saltos de línea, se considera una respuesta INCORRECTA.

      Estructura obligatoria:
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
        "doctor_id": "El UUID del especialista SOLO si el paciente eligió uno de la lista de Doctores Disponibles; en cualquier otro caso, vacío",
        "paso": "el_paso_actual (debe coincidir con ESTADO ACTUAL DEL FLUJO o avanzar según las reglas)"
      }}
      
      * El formato de WhatsApp (asteriscos, guiones, saltos de línea) va exclusivamente en "reply". Todos los demás campos del JSON ("action", "fecha", "hora", "procedimiento_id", "cita_id", "Nombre", "Apellido", "correo", "doctor_id", "paso") van en texto plano, sin asteriscos y sin saltos de línea. Nunca formatees ni acortes un UUID.
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
      returnIntermediateSteps: true,
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
      supervisedBlock,
      ambiguityBlock,
    });

    const toolsUsed: string[] = Array.isArray((response as any).intermediateSteps)
      ? (response as any).intermediateSteps
          .map((s: any) => s?.action?.tool)
          .filter((t: any): t is string => typeof t === 'string')
      : [];

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
        // Solo se usa cuando el paciente elige especialista; si va vacío, el
        // sistema lo asigna por disponibilidad.
        doctor_id: parsedJson.doctor_id || existingMetadata.booking?.doctor_id || '',
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
    let finalStep: string = nextStepText;
    if (response.output !== 'ERROR_TECNICO_ESCALANDO_A_HUMANO') {
      const existingMetadataAfter = await this.prisma.conversation.findUnique({
        where: { id: params.conversationId }
      });
      const currentBooking = (existingMetadataAfter?.metadata as any)?.booking || {};

      const nextStep = await this.stateManager.calculateNextStep(
        params.conversationId,
        params.currentStep as ConversationStep,
        classification.intent,
        classification.confidence,
        currentBooking
      );
      finalStep = nextStep;

      // 7. Acción transaccional DETERMINISTA: solo al llegar a `listo_para_ejecucion`.
      //    Implementa la regla crítica del doc: no se agenda hasta este estado.
      if (nextStep === 'listo_para_ejecucion') {
        if (params.simulate) {
          replyText = `[SIMULADO] Tu cita quedó agendada para el ${currentBooking.fecha || ''} a las ${currentBooking.hora || ''}.`;
          await this.prisma.conversation.update({
            where: { id: params.conversationId },
            data: { currentStep: 'concluido' },
          });
          finalStep = 'concluido';
        } else {
          try {
            const scheduled = await this.executeScheduling(
              params.clinicId,
              params.conversationId,
              params.contact,
              currentBooking,
            );
            replyText = scheduled.reply;
            if (scheduled.success) {
              await this.prisma.conversation.update({
                where: { id: params.conversationId },
                data: { currentStep: 'concluido' },
              });
              finalStep = 'concluido';
            }
          } catch (e) {
            this.logger.error(`Error al agendar la cita: ${(e as Error).message}`);
            replyText = 'Tuvimos un problema al confirmar tu cita. Un asesor te contactará en breve.';
            await this.humanTool.escalate(params.conversationId, `Error al agendar: ${(e as Error).message}`);
            finalStep = 'human_takeover';
          }
        }
      }

      // 7.b Elección de especialista, en su momento y no al final.
      //     Con tratamiento, fecha y hora ya fijados, si el tratamiento lo
      //     atienden varios y hay más de uno libre a esa hora, hay que
      //     preguntar. Se hace aquí y no en el prompt porque el modelo sigue el
      //     paso del flujo antes que una instrucción de texto: pedía el nombre
      //     y el correo y recién al agendar aparecía la pregunta del doctor,
      //     obligando al paciente a dar todos sus datos para nada.
      if (
        finalStep !== 'concluido' &&
        currentBooking.procedimiento_id &&
        currentBooking.fecha &&
        currentBooking.hora &&
        !currentBooking.doctor_id
      ) {
        const preguntaDoctor = await this.askDoctorIfAmbiguous(
          params.clinicId,
          currentBooking,
        );
        if (preguntaDoctor) {
          replyText = preguntaDoctor;
        }
      }

      // 8. Guardarraíl: el modelo no puede dar por hecha una reserva que el
      //    sistema no ejecutó. Solo executeScheduling confirma, y ese camino ya
      //    sustituye el texto; si llegamos aquí sin 'concluido', la cita no
      //    existe. El prompt ya lo prohíbe, pero una prohibición en el prompt es
      //    probabilística y aquí el coste de fallar es que el paciente se quede
      //    creyendo que tiene una hora que nadie reservó.
      if (finalStep !== 'concluido' && claimsBookingDone(replyText)) {
        this.logger.error(
          `El modelo anunció una cita no agendada (paso real: ${finalStep}). Respuesta sustituida.`,
        );
        replyText = buildMissingDataReply(currentBooking);
      }
    }

    return {
      text: sanitizeReply(replyText),
      currentStep: finalStep,
      intent: classification.intent,
      certainty: classification.confidence,
      toolsUsed,
    };
  }

  /**
   * Elige el especialista de forma determinista.
   *
   * Antes se tomaba sin más el primer doctor vinculado al tratamiento, sin
   * comprobar si estaba libre: se podían crear dos citas solapadas al mismo
   * especialista.
   *
   * Reglas:
   *  - Si el paciente ya eligió uno, se respeta (validando que haga ese
   *    tratamiento y esté libre).
   *  - Si el tratamiento lo hace un solo doctor, se asigna.
   *  - Si lo hacen varios, se mira quién está libre a esa hora. Si solo queda
   *    uno, se asigna sin preguntar: la disponibilidad ya deshizo la ambigüedad.
   *  - Solo se pregunta cuando hay más de uno libre y la elección es real.
   */
  private async selectDoctor(
    clinicId: string,
    treatment: any,
    scheduledAt: Date,
    booking: any,
  ): Promise<{ doctorId?: string; doctorName?: string; reply?: string }> {
    const hora = String(booking?.hora || '').trim();

    const candidatos: { id: string; name: string }[] = (treatment.doctors || [])
      .filter((dt: any) => dt.doctor && dt.doctor.active !== false)
      .map((dt: any) => ({ id: dt.doctor.id, name: dt.doctor.name }));

    if (candidatos.length === 0) {
      return {
        reply: `Ahora mismo no tengo especialista asignado para ${treatment.name}. Le paso tu solicitud al equipo para que te contacte.`,
      };
    }

    const estaLibre = async (doctorId: string) => {
      const slots = await this.availabilityTool.getAvailableSlots(
        clinicId,
        scheduledAt,
        treatment.id,
        doctorId,
      );
      return slots.includes(hora);
    };

    // El paciente pidió un especialista concreto.
    if (booking?.doctor_id) {
      const elegido = candidatos.find((d) => d.id === booking.doctor_id);
      if (!elegido) {
        return {
          reply: `Ese especialista no atiende ${treatment.name}. ¿Quieres que te asigne uno que sí lo haga?`,
        };
      }
      if (!(await estaLibre(elegido.id))) {
        return {
          reply: `${elegido.name} no tiene libre las *${hora}*. ¿Prefieres otra hora con ${elegido.name}, o que te asigne otro especialista?`,
        };
      }
      return { doctorId: elegido.id, doctorName: elegido.name };
    }

    if (candidatos.length === 1) {
      const unico = candidatos[0];
      if (!(await estaLibre(unico.id))) {
        return {
          reply: `Las *${hora}* ya no están disponibles para ${treatment.name}. ¿Quieres que busque otra hora?`,
        };
      }
      return { doctorId: unico.id, doctorName: unico.name };
    }

    const libres: { id: string; name: string }[] = [];
    for (const c of candidatos) {
      if (await estaLibre(c.id)) libres.push(c);
    }

    if (libres.length === 0) {
      return {
        reply: `Las *${hora}* ya no están disponibles para ${treatment.name}. ¿Quieres que busque otra hora?`,
      };
    }
    if (libres.length === 1) {
      return { doctorId: libres[0].id, doctorName: libres[0].name };
    }

    const listado = libres.map((d) => `- ${d.name}`).join('\n');
    return {
      reply: `Para ${treatment.name} a las *${hora}* tengo disponibles a:\n\n${listado}\n\n¿Con cuál prefieres?`,
    };
  }

  /**
   * Devuelve la pregunta por el especialista solo si de verdad hay que elegir:
   * varios profesionales atienden ese tratamiento y más de uno está libre a esa
   * hora. Si no hay ambigüedad devuelve null y el sistema asigna solo.
   */
  private async askDoctorIfAmbiguous(clinicId: string, booking: any): Promise<string | null> {
    try {
      const scheduledAt = this.parseBookingDateTime(booking.fecha, booking.hora);
      if (!scheduledAt) return null;

      const treatment = await this.prisma.treatment.findFirst({
        where: { id: booking.procedimiento_id, clinicId },
        include: { doctors: { include: { doctor: true } } },
      });
      if (!treatment) return null;

      const candidatos = (treatment.doctors || [])
        .filter((dt: any) => dt.doctor && dt.doctor.active !== false)
        .map((dt: any) => ({ id: dt.doctor.id, name: dt.doctor.name }));
      if (candidatos.length < 2) return null;

      const libres: { id: string; name: string }[] = [];
      for (const c of candidatos) {
        const slots = await this.availabilityTool.getAvailableSlots(
          clinicId,
          scheduledAt,
          treatment.id,
          c.id,
        );
        if (slots.includes(String(booking.hora).trim())) libres.push(c);
      }
      if (libres.length < 2) return null;

      const listado = libres.map((d) => `- ${d.name}`).join('\n');
      return `Para *${treatment.name}* a las *${booking.hora}* puedo agendarte con:\n\n${listado}\n\n¿Con cuál prefieres?`;
    } catch (e) {
      this.logger.warn(`No se pudo resolver la pregunta de especialista: ${(e as Error).message}`);
      return null;
    }
  }

  private parseBookingDateTime(fecha?: string, hora?: string): Date | null {
    if (!fecha || !hora) return null;
    let y: number, m: number, d: number;
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha.trim());
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
    if (dmy) { d = +dmy[1]; m = +dmy[2]; y = +dmy[3]; }
    else if (ymd) { y = +ymd[1]; m = +ymd[2]; d = +ymd[3]; }
    else return null;
    const hm = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
    if (!hm) return null;
    const dt = new Date(y, m - 1, d, +hm[1], +hm[2], 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  private async executeScheduling(
    clinicId: string,
    conversationId: string,
    contact: any,
    booking: any,
  ): Promise<{ success: boolean; reply: string }> {
    if (!booking?.procedimiento_id) {
      return { success: false, reply: 'No pude identificar el tratamiento para agendar. ¿Cuál necesitas?' };
    }

    const treatment = await this.prisma.treatment.findFirst({
      where: { id: booking.procedimiento_id, clinicId },
      include: { doctors: { include: { doctor: true } } },
    });
    if (!treatment) {
      return { success: false, reply: 'No pude encontrar ese tratamiento en el catálogo de la clínica.' };
    }

    const scheduledAt = this.parseBookingDateTime(booking.fecha, booking.hora);
    if (!scheduledAt) {
      return { success: false, reply: 'La fecha u hora de la cita no son válidas. ¿Podrías confirmarlas?' };
    }

    const seleccion = await this.selectDoctor(clinicId, treatment, scheduledAt, booking);
    if (!seleccion.doctorId) {
      return { success: false, reply: seleccion.reply! };
    }
    const doctorId = seleccion.doctorId;

    const durationMin = (treatment as any).durationMin ?? treatment.durationAvgMin ?? 30;
    const contactName =
      [booking.Nombre, booking.Apellido].filter(Boolean).join(' ') || contact?.name || null;

    const res = await this.actionsTool.scheduleAppointment(clinicId, {
      conversationId,
      contactId: contact?.id ?? null,
      treatmentId: treatment.id,
      doctorId,
      scheduledAt,
      durationMin,
      contactName,
    });

    if (!res.success) {
      return { success: false, reply: `Ese horario ya no está disponible. ¿Quieres que busque otro para ${treatment.name}?` };
    }

    // Esta es la única confirmación real de una reserva, así que sigue las
    // mismas reglas de estilo que el resto: "hora" y no "cita", fecha en
    // formato humano y el dato clave en negrita.
    const conEspecialista = seleccion.doctorName ? ` con *${seleccion.doctorName}*` : '';
    return {
      success: true,
      reply:
        `¡Listo! Tu hora de *${treatment.name}* quedó agendada para el ` +
        `*${formatFechaHumana(scheduledAt)}* a las *${booking.hora}*${conEspecialista}.` +
        `\n\nSi necesitas cambiarla o cancelarla, avísame.`,
    };
  }
}

/**
 * Última pasada sobre el texto que ve el paciente.
 *
 * El prompt prohíbe "te gustaría" por sonar a formulario traducido, pero una
 * prohibición léxica en el prompt es probabilística: se cumple casi siempre y
 * falla sin avisar. Para una regla determinista como esta, el sitio correcto
 * es el código.
 *
 * Solo se sustituye esta expresión, y por "quieres", que encaja en las mismas
 * construcciones ("¿te gustaría agendar?" -> "¿quieres agendar?"). No se toca
 * "cita": cambiarla por "hora" automáticamente rompería frases como "cita
 * previa" o alteraría el sentido según el contexto, y ahí el prompt es el
 * lugar adecuado.
 */
/**
 * ¿El paciente pidió EXPLÍCITAMENTE hablar con una persona?
 * Se normalizan acentos para que "recepcion" y "recepción" pesen igual.
 */
export function pideHumanoExplicitamente(text: string): boolean {
  const t = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /\b(hablar|habla|comunicar|comunicame|contactar|pasame|paseme|derivame|deriveme|atienda|atiendame)\b[\s\S]{0,30}\b(persona|humano|humana|asesor|asesora|ejecutivo|ejecutiva|operador|operadora|secretaria|recepcion|alguien|doctor|dentista)\b/.test(t)
    || /\b(quiero|necesito|puedo|prefiero)\b[\s\S]{0,25}\b(hablar|habla)\b[\s\S]{0,25}\b(persona|humano|humana|asesor|alguien|real)\b/.test(t)
    || /\b(un|una)\s+(humano|humana|persona\s+real|asesor|asesora|ejecutivo|ejecutiva)\b/.test(t)
    || /\bno\s+(quiero|kiero)\s+(hablar\s+con\s+)?(un\s+)?(bot|robot|maquina|maquinita|ia)\b/.test(t);
}

/** Señales de urgencia dental que justifican pasar a una persona sin más trámite. */
export function esUrgenciaDental(text: string): boolean {
  const t = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /\b(urgencia|urgente|emergencia)\b/.test(t)
    || /\bno\s+(aguanto|soporto|puedo\s+mas)\b/.test(t)
    || /\b(sangra|sangrando|sangrado|hemorragia)\b/.test(t)
    || /\b(se\s+me\s+)?(cayo|quebro|rompio|partio)\b[\s\S]{0,20}\b(diente|muela|corona|pieza)\b/.test(t)
    || /\bdolor\b[\s\S]{0,20}\b(insoportable|fuerte|terrible|horrible|agudo)\b/.test(t)
    || /\b(hinch\w*|inflamad[oa]|absceso|flegmon|flemon)\b/.test(t);
}

export function sanitizeReply(text: string): string {
  if (!text) return text;
  return text
    .replace(/\bTe gustaría\b/g, 'Quieres')
    .replace(/\bte gustaría\b/g, 'quieres');
}

/** Frases con las que el modelo da por hecha una reserva. Solo afirmaciones:
 *  una pregunta como "¿quieres que te la deje agendada?" no cuenta. */
const BOOKING_CLAIM_PATTERNS = [
  /\bagendad[oa]\b\s*(para|el|:)/i,
  /\b(qued[oó]|quedar[oó]n|est[aá]|ya est[aá])\s+(agendad[oa]|reservad[oa]|confirmad[oa])/i,
  /\b(tu|su)\s+(hora|cita)\s+(qued[oó]|est[aá]|ya)/i,
  /\breserva\s+(confirmada|realizada|hecha|lista)\b/i,
];

export function claimsBookingDone(text: string): boolean {
  if (!text) return false;
  return BOOKING_CLAIM_PATTERNS.some((re) => re.test(text));
}

/**
 * Mensaje de reemplazo cuando el modelo confirmó de más: pide el primer dato
 * que falta, en el mismo orden que exige la máquina de estados.
 */
export function buildMissingDataReply(booking: any): string {
  const b = booking || {};
  if (!b.procedimiento_id) {
    return 'Para reservarte la hora necesito saber qué tratamiento necesitas.\n\n¿Me dices cuál?';
  }
  if (!b.fecha) {
    return 'Me falta la fecha para dejar la reserva.\n\n¿Qué día te acomoda?';
  }
  if (!b.hora) {
    return 'Me falta la hora para dejar la reserva.\n\n¿A qué hora te acomoda?';
  }
  if (!b.Nombre || !b.Apellido) {
    return 'Me falta tu nombre completo para dejar la reserva.\n\n¿Me lo das?';
  }
  if (!b.correo) {
    return 'Solo me falta tu correo para dejar la reserva.\n\n¿Me lo compartes?';
  }
  // Nada de "en un momento te confirmo": el agente no trabaja en segundo plano
  // y esa confirmación no llegaría nunca. Si con todos los datos aún no se pudo
  // reservar, lo honesto es decirlo y pasar la conversación al equipo.
  return (
    'Estoy teniendo un problema para dejar tu reserva registrada. ' +
    'Le aviso al equipo de la clínica para que te confirmen la hora directamente.'
  );
}

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "miércoles 16 de septiembre". Sin año, igual que pide el prompt para el texto al paciente. */
export function formatFechaHumana(date: Date): string {
  return `${DIAS_ES[date.getDay()]} ${date.getDate()} de ${MESES_ES[date.getMonth()]}`;
}

/** Pesos chilenos con punto de miles: 25000 -> "$25.000". */
export function formatCLP(value: number | null | undefined): string {
  if (value == null) return '';
  return `$${Math.round(value).toLocaleString('es-CL')}`;
}
