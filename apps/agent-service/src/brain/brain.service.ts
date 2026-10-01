import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@deviaty/shared-prisma';
import { explicarSinHoras, normalizarRut } from '@deviaty/shared-utils';
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
    const modelo = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    this.model = new ChatOpenAI({
      openAIApiKey: this.configService.get('OPENAI_API_KEY'),
      // Modelo del agente. Configurable porque es la palanca más directa contra
      // las invenciones, y cambiarla no debería exigir tocar el código: se ajusta
      // en el .env del servidor y se reinicia el servicio.
      modelName: modelo,
      // La familia gpt-5 y los modelos de razonamiento SOLO aceptan la
      // temperatura por defecto: enviarles 0 devuelve un 400 y el agente deja
      // de responder por completo. Se decide por el modelo, no a mano, para
      // que cambiarlo en el .env no pueda tumbar el servicio.
      temperature: esDeRazonamiento(modelo) ? 1 : 0,
      modelKwargs: {
        response_format: { type: 'json_object' },
        // Un modelo de razonamiento "piensa" antes de responder, y eso se paga
        // en segundos. Medido con nuestro prompt real (~8.000 tokens):
        // gpt-5-mini tardaba 28,8s por llamada gastando 704 tokens de
        // razonamiento; con 'minimal' baja a 4,0s y 0 tokens. El esfuerzo crece
        // con el tamaño del prompt, así que con uno grande el valor por defecto
        // es inasumible para WhatsApp, donde cada mensaje es un turno.
        //
        // Aquí el razonamiento aporta poco: las decisiones que de verdad
        // importan (disponibilidad, especialista, fechas) ya se resuelven en
        // código y llegan masticadas en el prompt y en las herramientas.
        ...(esDeRazonamiento(modelo)
          ? { reasoning_effort: this.configService.get<string>('OPENAI_REASONING_EFFORT') || 'minimal' }
          : {}),
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

    // Una conversación que ya terminó su reserva vuelve a empezar de cero. Sin
    // esto, los datos de la reserva anterior seguían en metadata y cualquier
    // mensaje posterior ("hola") se interpretaba como la continuación de aquella:
    // el sistema reintentaba agendar una fecha ya pasada y respondía cosas como
    // "el Dr. X no tiene libre las 16:30" a un saludo.
    if (params.currentStep === 'concluido' && params.metadata?.booking) {
      this.logger.log(`Conversación ${params.conversationId} ya concluida: se limpia la reserva anterior y se reinicia el flujo.`);
      params.metadata = { ...params.metadata, booking: {} };
      params.currentStep = 'inicio';
      await this.prisma.conversation.update({
        where: { id: params.conversationId },
        data: { metadata: params.metadata, currentStep: 'inicio' },
      });
    }

    // Visita nueva: el paciente vuelve después de un día o más sin mensajes.
    // Las conversaciones no se cierran solas, así que la de un paciente es la
    // misma durante semanas, con la reserva que dejó a medias. Un "hola, esto
    // es una prueba" una semana después recibió "me falta la hora para dejar
    // la reserva", y luego se le ofreció la limpieza que había pedido el día 24.
    // Se descarta la reserva en curso y el modelo solo ve esta visita: lo de
    // antes no es contexto, es ruido que contesta por él. Las horas que de
    // verdad tiene reservadas siguen llegando por HORAS RESERVADAS.
    // El recorte vale para todos los turnos de la visita, no solo el primero:
    // en el segundo, el historial vuelve a traer los mensajes de hace una semana.
    const visita = desdeElUltimoSilencio(params.history, HORAS_PARA_VISITA_NUEVA);
    params.history = visita.mensajes;
    if (visita.esNueva) {
      const habiaReserva = Object.keys(params.metadata?.booking || {}).length > 0;
      if (habiaReserva || params.currentStep !== 'inicio') {
        this.logger.log(
          `Conversación ${params.conversationId}: el paciente vuelve tras ${visita.horasDeSilencio} h; ` +
            `se descarta la reserva a medias (paso ${params.currentStep}) y se empieza de cero.`,
        );
        params.metadata = { ...(params.metadata || {}), booking: {} };
        params.currentStep = 'inicio';
        await this.prisma.conversation.update({
          where: { id: params.conversationId },
          data: { metadata: params.metadata, currentStep: 'inicio' },
        });
      }
    }

    // Una fecha de reserva que ya pasó no sirve para nada y arrastra al modelo
    // a hablar de ella. Se borra con su hora; el resto de los datos se conserva.
    const fechaGuardada = parseFechaReserva(params.metadata?.booking?.fecha);
    if (fechaGuardada && format(fechaGuardada, 'yyyy-MM-dd') < currentDate) {
      this.logger.log(`Conversación ${params.conversationId}: la fecha ${params.metadata.booking.fecha} ya pasó; se descarta.`);
      params.metadata = { ...params.metadata, booking: { ...params.metadata.booking, fecha: '', hora: '' } };
      await this.prisma.conversation.update({
        where: { id: params.conversationId },
        data: { metadata: params.metadata },
      });
    }

    // Calendario de los próximos días, ya resuelto.
    //
    // Antes se le daba la fecha de hoy y el nombre del día, y el modelo tenía
    // que calcular el resto. Se equivocaba: a un paciente que pidió "el
    // miércoles" le respondió "miércoles 22 de septiembre" cuando el 22 era
    // martes, y le quedó la hora un día antes del que pidió. Contar días no es
    // algo que un modelo de lenguaje deba hacer a ojo, así que se le entrega
    // hecho y solo tiene que buscar en la tabla.
    const calendarioProximosDias = Array.from({ length: 21 }, (_, i) => {
      const d = new Date(nowLocal);
      d.setDate(d.getDate() + i);
      const nombre = DIAS_SEMANA[d.getDay()];
      const etiqueta = i === 0 ? ' (HOY)' : i === 1 ? ' (MAÑANA)' : i === 2 ? ' (PASADO MAÑANA)' : '';
      return `- ${nombre} ${format(d, 'dd/MM/yyyy')}${etiqueta}`;
    }).join('\n');

    const bookingState = (params.metadata?.booking || {}) as {
      fecha?: string;
      hora?: string;
      procedimiento_id?: string;
      Nombre?: string;
      Apellido?: string;
      correo?: string;
      cita_id?: string;
      doctor_id?: string;
      rut?: string;
      direccion?: string;
      respuesta_tratamiento?: string;
      /** El paciente dijo que le da igual el especialista. */
      doctor_sin_preferencia?: boolean;
    };

    // Citas futuras de este paciente, ya resueltas.
    //
    // Sin esto, quien pedía cambiar su hora acababa dando de nuevo el
    // tratamiento, el nombre y el correo: el bloque de DATOS NECESARIOS PARA
    // AGENDAR y un estado de reserva vacío dominan el prompt, y las reglas de
    // reprogramación competían contra eso y perdían. Con las citas delante y su
    // identificador, el agente no tiene que ir a buscarlas ni puede inventarlas.
    const citasActivas = params.contact?.id
      ? await this.prisma.appointment.findMany({
          where: {
            clinicId: params.clinicId,
            contactId: params.contact.id,
            status: { notIn: ['CANCELLED', 'COMPLETED'] },
            scheduledAt: { gte: new Date() },
          },
          include: { treatment: true, doctor: true },
          orderBy: { scheduledAt: 'asc' },
          take: 5,
        })
      : [];

    const citasActivasBlock = citasActivas.length
      ? `📌 HORAS QUE ESTE PACIENTE YA TIENE RESERVADAS:\n` +
        citasActivas
          .map(
            (a: any) =>
              `- [cita_id: ${a.id}] ${a.treatment?.name ?? 'Tratamiento'} el ` +
              `${formatFechaHumana(a.scheduledAt)} a las ${format(a.scheduledAt, 'HH:mm')}` +
              `${a.doctor?.name ? ` con ${a.doctor.name}` : ''}`,
          )
          .join('\n') +
        `\n\nSi quiere CAMBIAR o ANULAR una de estas, NO es una reserva nueva:\n` +
        `- No le vuelvas a pedir el tratamiento, ni el nombre, ni el correo: ya los tiene esa hora.\n` +
        `- Lo único que necesitas es CUÁL de estas horas y, si la cambia, el nuevo día y la nueva hora.\n` +
        `- Con una sola hora reservada, es esa: no le preguntes cuál.\n` +
        `- Para cambiarla invoca 'reschedule_appointment' con ese cita_id. Para anularla, 'cancel_appointment'.\n` +
        `- No des el cambio por hecho hasta que la herramienta responda que salió bien.`
      : '';

    const bookingStateBlock = `ESTADO DE AGENDAMIENTO PERSISTIDO EN BASE DE DATOS:
- Cita ID a modificar/cancelar (cita_id): ${bookingState.cita_id || 'vacío'}
- Procedimiento ID (procedimiento_id): ${bookingState.procedimiento_id || 'vacío'}
- Fecha agendada (fecha): ${bookingState.fecha || 'vacío'}
- Hora agendada (hora): ${bookingState.hora || 'vacío'}
- Nombre paciente (Nombre): ${bookingState.Nombre || 'vacío'}
- Apellido paciente (Apellido): ${bookingState.Apellido || 'vacío'}
- Correo electrónico (correo): ${bookingState.correo || 'vacío'}
- RUT (rut): ${bookingState.rut || 'vacío'}
- Dirección (direccion): ${bookingState.direccion || 'vacío'}
- Respuesta a la pregunta del tratamiento (respuesta_tratamiento): ${bookingState.respuesta_tratamiento || 'vacío'}
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

            // El especialista ya elegido manda sobre lo que pase el modelo. La
            // agenda que interesa es la suya: sin fijarlo aquí, la herramienta
            // devuelve las horas en que está libre CUALQUIERA de los que hacen
            // ese tratamiento, y se le acaba ofreciendo al paciente una hora
            // que su profesional no tiene.
            const doctorEfectivo = bookingState.doctor_id || doctor_id;
            const tratamientoEfectivo = bookingState.procedimiento_id || treatment_id;

            // Si el paciente está moviendo una hora, esa hora no puede
            // bloquearse a sí misma. Sin esto, tras cambiarla a las 17:00 la
            // siguiente comprobación daba las 17:00 por ocupadas —por su propia
            // cita— y la hora rebotaba entre horarios sin quedarse en ninguno.
            const citaQueSeMueve =
              bookingState.cita_id || (citasActivas.length === 1 ? citasActivas[0].id : undefined);

            const slots = await this.availabilityTool.getAvailableSlots(
              params.clinicId,
              localDate,
              tratamientoEfectivo,
              doctorEfectivo,
              citaQueSeMueve,
            );

            // Se resuelven aquí y no se reutiliza la lista del principio del
            // turno: aquella se arma con el tratamiento que había al empezar, y
            // si el paciente lo acaba de decir, llega vacía. Con ella vacía no
            // se nombraba al profesional ni se ofrecían las horas de un colega.
            const candidatos = await this.especialistasDe(params.clinicId, tratamientoEfectivo);

            const nombreDoctor = doctorEfectivo
              ? candidatos.find((d) => d.id === doctorEfectivo)?.name
              : undefined;
            const conQuien = nombreDoctor ? ` con ${nombreDoctor}` : '';

            if (slots.length === 0) {
              // El motivo va SIEMPRE. Un "no hay disponibilidad" a secas deja al
              // modelo sin explicación que dar, y entonces se la inventa: a un
              // paciente que pidió el viernes 25 le dijo que ese día ya había
              // pasado, faltando dos días y habiendo afirmado él mismo, un
              // mensaje antes, que hoy era 23.
              const motivo = await explicarSinHoras(
                this.prisma,
                params.clinicId,
                localDate,
                tratamientoEfectivo,
                doctorEfectivo,
              );
              const yaPaso = motivo === 'ese día ya pasó';

              const alternativas = await this.horasDeOtrosEspecialistas(
                params.clinicId,
                localDate,
                tratamientoEfectivo,
                doctorEfectivo,
                candidatos,
                undefined,
                citaQueSeMueve,
              );

              const conOtros = alternativas
                ? ` Sí atienden ese día: ${alternativas}.`
                : '';

              return (
                `Sin horas${conQuien} el ${date}. MOTIVO: ${motivo}.${conOtros}` +
                ` Explícale el motivo con tus palabras y ofrécele una alternativa.` +
                (yaPaso
                  ? ''
                  : ` ESA FECHA NO HA PASADO: es una fecha futura y tienes PROHIBIDO decirle al paciente lo contrario.`)
              );
            }

            // Cuando el paciente pidió una hora concreta, la herramienta
            // responde por sí o por no. Antes se devolvía siempre la lista
            // completa y el modelo decidía mirándola; como además tiene orden
            // de mostrar como mucho 5 opciones, llegó a dar por ocupada una
            // hora que sí estaba libre solo porque no entraba en ese recorte.
            if (time) {
              const pedida = time.trim();
              if (slots.includes(pedida)) {
                return `CONFIRMADO: la hora ${pedida} está DISPONIBLE${conQuien}. Dala por buena y continúa con el siguiente dato que falte.`;
              }
              // Ocupado ESE profesional a ESA hora: antes de hacerle mover la
              // hora, mirar si otro la tiene libre. Es la disyuntiva real del
              // paciente: cambiar de hora o cambiar de especialista.
              const otros = await this.horasDeOtrosEspecialistas(
                params.clinicId,
                localDate,
                tratamientoEfectivo,
                doctorEfectivo,
                candidatos,
                pedida,
                citaQueSeMueve,
              );
              const alternativa = otros ? ` A las ${pedida} sí está libre: ${otros}.` : '';
              return (
                `La hora ${pedida} NO está disponible${conQuien}.${alternativa}` +
                ` Otras horas libres${conQuien} ese día: ${slots.join(', ')}`
              );
            }

            return `Horarios disponibles${conQuien} ese día: ${slots.join(', ')}`;
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
            // Quién atiende cada tratamiento. Sin esto el modelo no podía
            // saberlo y llegó a ofrecer una endodoncia con una profesional que
            // no la hace.
            doctors: { include: { doctor: true } },
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

            // Los especialistas van junto a cada tratamiento porque la pregunta
            // "¿con quién prefieres?" ocurre en el mismo turno en que el
            // paciente lo elige, cuando el tratamiento todavía no está
            // persistido. Con la lista aquí, el modelo nunca tiene que adivinar.
            const quienes = ((t as any).doctors || [])
              .filter((dt: any) => dt.doctor && dt.doctor.active !== false)
              .map((dt: any) => `[ID: ${dt.doctor.id}] ${dt.doctor.name}`);
            const atiende = quienes.length
              ? ` Lo atienden: ${quienes.join(' · ')}`
              : ' Sin especialista asignado: no lo ofrezcas para agendar.';

            // Pregunta propia del tratamiento (la pieza en una endodoncia, por
            // ejemplo). Va junto al tratamiento para que el agente la vea en el
            // momento de elegirlo, no en un bloque aparte que puede llegar tarde.
            const extra = (t as any).extraQuestion
              ? ` ANTES DE RESERVARLO PREGUNTA: "${(t as any).extraQuestion}" y guarda la respuesta en "respuesta_tratamiento".`
              : '';

            return `- [ID: ${t.id}] ${t.name}${duration}. Precios: ${priceList}.${atiende}${extra}`;
          })
          .join('\n')
      : 'No hay tratamientos disponibles actualmente.';

    // Especialistas que atienden el tratamiento YA elegido. El modelo no tenía
    // forma de saberlo: la lista de doctores solo trae nombre y título, y la de
    // tratamientos no menciona especialistas. Sin este dato no puede preguntar
    // con quién quiere atenderse, ni reconocer al que le nombren.
    const doctoresDelTratamiento = await this.especialistasDe(
      params.clinicId,
      bookingState.procedimiento_id,
    );

    // "Con el que tenga hora antes", "me da igual": el paciente ya contestó, y
    // contestó que no elige. Antes eso no quedaba en ninguna parte: el doctor
    // seguía vacío, el paso seguía en 'esperando_doctor' y el agente le
    // preguntaba lo mismo dos veces más, la última ya con la hora elegida.
    // Se decide aquí y no en el prompt por lo mismo de siempre: el modelo sigue
    // el paso del flujo antes que una instrucción de texto.
    const hablandoDeEspecialista =
      params.currentStep === 'esperando_doctor' ||
      preguntaPorEspecialista(String(lastAgentMessage || '')) ||
      mencionaEspecialista(params.userInput);
    const pacienteSinPreferencia =
      Boolean(bookingState.doctor_sin_preferencia) ||
      (hablandoDeEspecialista && sinPreferenciaDeEspecialista(params.userInput));

    // Solo se pregunta cuando de verdad hay algo que elegir.
    const requiereEleccionDoctor =
      doctoresDelTratamiento.length > 1 && !bookingState.doctor_id && !pacienteSinPreferencia;

    const especialistasBlock = bookingState.procedimiento_id
      ? doctoresDelTratamiento.length === 0
        ? '👩‍⚕️ ESPECIALISTAS PARA ESE TRATAMIENTO: ninguno configurado. No ofrezcas horas; dile que el equipo le confirma y no inventes un profesional.'
        : doctoresDelTratamiento.length === 1
          ? `👩‍⚕️ ESPECIALISTA PARA ESE TRATAMIENTO: ${doctoresDelTratamiento[0].name}. Es el único que lo atiende, así que NO preguntes con quién prefiere: el sistema lo asigna solo. Deja "doctor_id" vacío.`
          : `👩‍⚕️ ESPECIALISTAS QUE ATIENDEN ESE TRATAMIENTO:\n${doctoresDelTratamiento
              .map((d) => `- [ID: ${d.id}] ${d.name}`)
              .join('\n')}\n` +
            (bookingState.doctor_id
              ? 'El paciente ya eligió; respeta esa elección y no vuelvas a preguntar.'
              : pacienteSinPreferencia
                ? 'El paciente NO tiene preferencia de especialista. No le preguntes con quién ni le hagas elegir entre ellos: llama a check_availability sin doctor_id, ofrécele las horas libres sin nombrar profesional, y el sistema le asigna uno que esté libre a la hora que elija. Deja "doctor_id" vacío.'
                : 'Pregúntale con cuál prefiere atenderse ANTES de hablar de días y horas, porque las horas libres son las de ese profesional, no las de la clínica. Si no tiene preferencia, deja "doctor_id" vacío y sigue con la fecha. Guarda el UUID del que elija en "doctor_id".')
      : '';

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

    // Prompt reescrito desde cero el 30/09. El anterior había llegado a 113
    // reglas y ~6.000 tokens a base de sumar una por cada fallo, y varias se
    // contradecían: una exigía negrita en toda respuesta (de ahí el "eco" de
    // repetir en negrita lo que el paciente acababa de decir), otra obligaba a
    // un turno de confirmar la fecha aunque el paciente ya la hubiera dado,
    // otra forzaba a terminar siempre en pregunta y no dejaba cerrar la
    // conversación. Las reglas que ya garantiza el código (fechas, especialista
    // único, markdown, RUT, anuncios falsos) se quitan de aquí: repetirlas solo
    // añadía tokens, y con un modelo de razonamiento, latencia.
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', `Eres la recepcionista virtual de la clínica dental "{clinicName}", en Chile. Atiendes a los pacientes por WhatsApp. Responde en su mismo idioma ({detectedLanguage}).

{supervisedBlock}

## CÓMO HABLAS

Como una buena recepcionista de clínica: cálida, clara y breve. Profesional, sin coloquialismos marcados. El paciente te lee en el teléfono, así que cada mensaje dice una sola cosa y hace avanzar la conversación.

- Trata de "tú". Si el paciente te trata de "usted", pasa a "usted" y mantenlo.
- Cuando ya sepas su nombre, úsalo de vez en cuando: "Gracias, Edguard".
- Di "hora", no "cita". Di "te acomoda" o "prefieres", no "te gustaría".
- Si te saluda, devuelve el saludo.
- Entra directo al contenido. Evita abrir con "Perfecto", "Listo" o "Entendido", y no repitas la misma fórmula en dos mensajes seguidos: suena a máquina.
- Usa el artículo correcto: "la endodoncia", "la limpieza", "la consulta".
- Nada de fórmulas de call-center: "estoy aquí para ayudarte", "no dudes en consultarme", "lamentablemente", "lo siento" automático.
- Emojis: como mucho uno, y solo al saludar o despedirte. Ninguno si hablas de dolor, precios o cancelaciones.

Así sí y así no (conversación real de un paciente):

NO:  *Tratamientos disponibles*
     - Limpieza Dental
     - Endodoncia …
     ¿Cuál necesitas? Indica el nombre exactamente.
SÍ:  ¡Hola! Claro, te ayudo. ¿Para qué tratamiento es?

NO:  *Endodoncia*
     ¿Qué día prefieres para agendar la hora?
SÍ:  La endodoncia la hace el Dr. Medina. ¿Qué día te acomoda?

NO:  Entonces sería el *lunes 28 de septiembre*. ¿Te lo confirmo?
     (el paciente acababa de escribir "el lunes a las 10")
SÍ:  El *lunes 28* a las *10:00* está libre. ¿Me das tu nombre y apellido para reservarla?

NO:  *Edguard Mata*
     ¿Me confirmas tu correo electrónico?
SÍ:  Gracias, Edguard. ¿Y tu RUT?

NO:  (tras "perfecto gracias") Quedo atenta si necesitas algo. ¿Deseas que haga algún cambio ahora?
SÍ:  ¡A ti, Edguard! Nos vemos el lunes 😊

## FORMATO DE WHATSAPP

- Negrita con un solo asterisco a cada lado, y solo para lo que el paciente tiene que retener: la fecha, la hora, el precio. Nunca una línea que sea solo negrita y nunca en palabras de relleno.
- Listas con "- " al comienzo de la línea.
- Mensajes cortos: normalmente de una a tres líneas.
- Fechas en formato humano ("lunes 28 de septiembre"), nunca "28/09/2026" en el texto. Horas en formato de 24 horas.

## CÓMO LLEVAR LA CONVERSACIÓN

Para una hora nueva necesitas, en este orden: el tratamiento; el especialista, solo si ese tratamiento lo atienden varios; el día y la hora; y después nombre y apellido, RUT, dirección y correo.

- Lee toda la conversación antes de responder. Si el paciente pregunta "cuánto cuesta", "cuánto dura" o "y eso qué es" sin nombrar el tratamiento, se refiere al que están conversando. Solo si no se ha hablado de ninguno, pregúntale cuál.
- Pide lo que falte, un dato por mensaje.
- Aprovecha todo lo que el paciente ya dijo. Si escribió "el lunes a las 10", ya tienes el día y la hora: no se los vuelvas a pedir ni le preguntes si lo confirmas. Comprueba esa hora con check_availability y dile si está libre.
- Solo registras lo que el paciente dijo expresamente. Nunca eliges por él: si le ofreciste varias horas, espera a que escoja una.
- Para saber si una hora concreta está libre, llama a check_availability con esa hora. No la des por ocupada por no verla en una lista que mostraste: las listas son solo una muestra.
- Si una hora no está libre, la herramienta te dice por qué. Díselo con tus palabras y, en el mismo mensaje, ofrécele alternativas concretas.
- Al ofrecer horas: si hay varios días posibles, nombra primero los días y deja que elija; dentro de un día, muestra como máximo cinco horas, separadas en mañana y tarde.
- "Confirmar" es solo para lo que ya tienes. Para pedir un dato nuevo: "¿Me das tu RUT?", no "¿Me confirmas tu RUT?".
- No todos los mensajes tienen que terminar en pregunta. Si el paciente cierra ("gracias", "perfecto", "listo") y no queda nada pendiente, despídete y ya.

Para cambiar o anular una hora que ya tiene, mira el bloque de HORAS RESERVADAS. No es una reserva nueva: no le pidas tratamiento, nombre ni datos personales. Solo necesitas cuál de sus horas, si tiene varias, y el nuevo día y hora. Usa reschedule_appointment o cancel_appointment.

## LO QUE NUNCA HACES

1. Inventar horas, disponibilidad o precios. Las horas salen de check_availability en este mismo turno; los precios, del listado de tratamientos. Si un precio figura como SIN_PRECIO_CONFIGURADO, dile que el equipo se lo confirma.
2. Ofrecer un tratamiento que no esté en el listado, ni deducirlo del título de un especialista.
3. Decir que una hora quedó reservada, cambiada o anulada si la herramienta no lo confirmó. La confirmación de una reserva nueva la envía el sistema, no tú.
4. Ofrecer lo que no puedes hacer: comprobantes por correo, llamadas, recordatorios a medida, "te aviso más tarde".
5. Calcular fechas por tu cuenta: búscalas en el CALENDARIO.
6. Suponer un tratamiento que el paciente no nombró. Si dudas cuál es, pregunta; nunca respondas con los datos de otro.

## LO QUE SABES DE LA CLÍNICA

- Contacto: {clinicInfo}
- Horario de atención:
{schedules}
- Especialistas:
{doctors}
- Tratamientos y precios (cada uno indica quién lo atiende):
{treatments}
- Políticas y preguntas frecuentes:
{policies}
{overridesBlock}

## HOY

{currentDayOfWeek} {currentDate}, {currentTime}.

CALENDARIO. Equivalencias reales entre día y fecha; si el paciente dice un día de la semana, es el más cercano que no haya pasado:
{calendarioProximosDias}

{citasActivasBlock}

{bookingStateBlock}

Paso actual del flujo: {currentStep}. Intención detectada: {intent}.

{especialistasBlock}

{ambiguityBlock}

## RESPUESTA (siempre un único objeto JSON, sin nada antes ni después)

{{
  "reply": "el mensaje para el paciente, con formato de WhatsApp",
  "action": "agendar | derivar_humano | ...",
  "fecha": "DD/MM/YYYY o vacío",
  "hora": "HH:MM o vacío",
  "procedimiento_id": "el UUID que figura como [ID: ...] en el listado de tratamientos, o vacío",
  "cita_id": "el UUID de la hora que se cambia o anula, o vacío",
  "doctor_id": "el UUID del especialista, solo si el paciente eligió uno; si no, vacío",
  "Nombre": "nombre de pila o vacío",
  "Apellido": "apellido o vacío",
  "rut": "el RUT tal como lo escribió el paciente, o vacío",
  "direccion": "dirección o vacío",
  "correo": "correo o vacío",
  "respuesta_tratamiento": "la respuesta a la pregunta propia del tratamiento, o vacío",
  "paso": "el paso del flujo"
}}

- Dentro de "reply", cada salto de línea se escribe como \\n. El resto de campos van en texto plano, sin formato.
- Copia tal cual los valores que ya estén en el ESTADO DE AGENDAMIENTO. Si dejas vacío un campo que ya tenía valor, lo borras.
`],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    // createToolCallingAgent y no createOpenAIFunctionsAgent: el segundo usa la
    // API antigua de "functions", que manda mensajes con role: 'function'. Los
    // modelos gpt-5 la rechazan con
    //   400 Unsupported value: 'messages[N].role' does not support 'function'
    // así que con ellos fallaba TODA conversación que invocara una herramienta.
    // Además OpenAI tiene esa API marcada como obsoleta, así que el cambio hay
    // que hacerlo igualmente.
    const agent = await createToolCallingAgent({
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
      calendarioProximosDias,
      bookingStateBlock,
      citasActivasBlock,
      supervisedBlock,
      ambiguityBlock,
      especialistasBlock,
    });

    const toolsUsed: string[] = Array.isArray((response as any).intermediateSteps)
      ? (response as any).intermediateSteps
          .map((s: any) => s?.action?.tool)
          .filter((t: any): t is string => typeof t === 'string')
      : [];

    // Se declara aquí porque el rechazo ocurre al fusionar el booking y se usa
    // más abajo, al redactar la respuesta.
    let rutRechazado = false;
    let apellidoRecuperado = false;
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
        rut: parsedJson.rut || existingMetadata.booking?.rut || '',
        direccion: parsedJson.direccion || existingMetadata.booking?.direccion || '',
        respuesta_tratamiento:
          parsedJson.respuesta_tratamiento || existingMetadata.booking?.respuesta_tratamiento || '',
        // El paciente dijo que le da igual con quién. Lo decide el sistema, no
        // el modelo, así que no viaja en el JSON de respuesta.
        doctor_sin_preferencia: pacienteSinPreferencia,
      };

      // El RUT se valida aquí, no en el prompt: el dígito verificador es
      // aritmética. Un RUT inventado en la ficha clínica es de los datos que
      // más caro salen, y el modelo no puede comprobarlo por su cuenta.
      if (updatedBooking.rut) {
        const normalizado = normalizarRut(updatedBooking.rut);
        if (normalizado) {
          updatedBooking.rut = normalizado;
        } else {
          this.logger.warn(`RUT descartado por inválido: "${updatedBooking.rut}".`);
          updatedBooking.rut = '';
          rutRechazado = true;
        }
      }
      
      // El apellido que el paciente escribió y el modelo se dejó.
      if (updatedBooking.Nombre && !updatedBooking.Apellido) {
        const dichoPorElPaciente = [
          ...(params.history || [])
            .filter((m: any) => String(m.role).toUpperCase() === 'USER')
            .map((m: any) => String(m.content || '')),
          params.userInput,
        ];
        const apellido = recuperarApellido(updatedBooking.Nombre, dichoPorElPaciente);
        if (apellido) {
          this.logger.log(
            `Apellido recuperado de lo que escribió el paciente: "${apellido}". El modelo solo había guardado "${updatedBooking.Nombre}".`,
          );
          updatedBooking.Nombre = String(updatedBooking.Nombre).split(/\s+/)[0];
          updatedBooking.Apellido = apellido;
          apellidoRecuperado = true;
        }
      }

      // Contraste del tratamiento elegido con lo que pidió el paciente.
      // El modelo fija el tratamiento copiando un UUID, y un UUID equivocado no
      // se nota en ninguna parte: un paciente pidió endodoncia durante toda la
      // conversación y su cita quedó como limpieza dental. Si el paciente nombró
      // UN solo tratamiento del catálogo y el elegido es otro, manda el paciente.
      if (updatedBooking.procedimiento_id) {
        const dichoPorElPaciente = [
          ...(params.history || [])
            .filter((m: any) => String(m.role).toUpperCase() === 'USER')
            .map((m: any) => String(m.content || '')),
          params.userInput,
        ];
        const mencionados = tratamientosMencionados(
          dichoPorElPaciente,
          activeTreatments.map((t: any) => ({ id: t.id, name: t.name })),
        );

        if (mencionados.length === 1 && mencionados[0].id !== updatedBooking.procedimiento_id) {
          const elegido = activeTreatments.find((t: any) => t.id === updatedBooking.procedimiento_id);
          this.logger.error(
            `Tratamiento corregido en la conversación ${params.conversationId}: el modelo eligió ` +
              `"${elegido?.name ?? updatedBooking.procedimiento_id}" pero el paciente solo habló de ` +
              `"${mencionados[0].name}". Se impone lo que dijo el paciente.`,
          );
          updatedBooking.procedimiento_id = mencionados[0].id;
          // El especialista y la hora se eligieron para el tratamiento erróneo y
          // su duración; con otro tratamiento hay que volver a validarlos.
          updatedBooking.doctor_id = '';
        }
      }

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
        currentBooking,
        requiereEleccionDoctor,
      );
      finalStep = nextStep;

      // 7. Acción transaccional DETERMINISTA: solo al llegar a `listo_para_ejecucion`.
      //    Implementa la regla crítica del doc: no se agenda hasta este estado.
      if (nextStep === 'listo_para_ejecucion') {
        if (params.simulate) {
          replyText = `[SIMULADO] Tu cita quedó agendada para el ${currentBooking.fecha || ''} a las ${currentBooking.hora || ''}.`;
          await this.prisma.conversation.update({
            where: { id: params.conversationId },
            data: {
              currentStep: 'concluido',
              metadata: { ...(existingMetadataAfter?.metadata as any), booking: {} },
            },
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
              // La reserva ya existe: los datos dejan de ser una solicitud
              // pendiente y hay que borrarlos. Si se quedan, cualquier mensaje
              // posterior los revive y el sistema intenta agendarlos otra vez.
              await this.prisma.conversation.update({
                where: { id: params.conversationId },
                data: {
                  currentStep: 'concluido',
                  metadata: { ...(existingMetadataAfter?.metadata as any), booking: {} },
                },
              });
              finalStep = 'concluido';
            } else if (scheduled.retryStep) {
              // Se retrocede al paso que corresponde y se olvidan los datos que
              // provocaron el fallo, para no quedarse reintentando lo mismo.
              const bookingDepurado = { ...currentBooking };
              for (const campo of scheduled.clearFields || []) {
                bookingDepurado[campo] = '';
              }
              await this.prisma.conversation.update({
                where: { id: params.conversationId },
                data: {
                  currentStep: scheduled.retryStep,
                  metadata: { ...(existingMetadataAfter?.metadata as any), booking: bookingDepurado },
                },
              });
              finalStep = scheduled.retryStep;
              Object.assign(currentBooking, bookingDepurado);
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
      // (El especialista ya no se pregunta aquí. Se pregunta al principio, justo
      //  después del tratamiento, porque las horas que se ofrecen son las suyas.
      //  Volver a preguntarlo en este punto sería preguntar dos veces, y a un
      //  paciente que ya dijo "me da igual" le sonaría a que no se le escuchó.)

      // 7.c Con un único especialista posible no hay nada que elegir.
      //     La regla está en el prompt, pero el modelo seguía ofreciendo listas
      //     de una sola opción ("- Dr. Miguel Medina. ¿Te acomoda con él?"), que
      //     le gasta un turno al paciente por una decisión que no existe. Se
      //     asigna aquí y, si la respuesta era esa pregunta, se sustituye por lo
      //     siguiente que de verdad falta.
      //     Los especialistas se recalculan AQUÍ, no se reutiliza la lista del
      //     principio del turno: aquella se arma con el tratamiento que había
      //     al empezar, y en el primer mensaje ("quiero una endodoncia") el
      //     tratamiento se fija en este mismo turno, así que llegaba vacía.
      const especialistasDelElegido = await this.especialistasDe(
        params.clinicId,
        currentBooking.procedimiento_id,
      );

      //     Ojo: la supresión NO puede condicionarse a que "doctor_id" esté
      //     vacío. El modelo rellena ese campo por su cuenta y AUN ASÍ formula
      //     la pregunta, que era justo lo que seguía pasando: con el campo ya
      //     puesto, la guarda se saltaba entera y la pregunta llegaba al
      //     paciente. Asignar y suprimir son dos cosas independientes.
      if (
        finalStep !== 'concluido' &&
        currentBooking.procedimiento_id &&
        especialistasDelElegido.length === 1
      ) {
        const unico = especialistasDelElegido[0];

        if (currentBooking.doctor_id !== unico.id) {
          currentBooking.doctor_id = unico.id;
          await this.prisma.conversation.update({
            where: { id: params.conversationId },
            data: {
              metadata: {
                ...((existingMetadataAfter?.metadata as any) || {}),
                booking: { ...currentBooking, doctor_id: unico.id },
              },
            },
          });
        }

        if (preguntaPorEspecialista(replyText)) {
          this.logger.log(
            `Pregunta por especialista suprimida: ${unico.name} es el único que atiende ese tratamiento.`,
          );
          replyText = buildMissingDataReply(currentBooking);
        }
      }

      // 7.d Sin preferencia de especialista y el modelo pregunta igual con cuál.
      //     El paciente ya respondió a eso; volver a preguntarlo es lo que le
      //     hace sentir que no se le escucha.
      if (
        finalStep !== 'concluido' &&
        currentBooking.doctor_sin_preferencia &&
        !currentBooking.doctor_id &&
        especialistasDelElegido.length > 1 &&
        preguntaPorEspecialista(replyText)
      ) {
        this.logger.log('Pregunta por especialista suprimida: el paciente dijo que no tiene preferencia.');
        replyText = respuestaSinElegirEspecialista(currentBooking);
      }

      // 7.e El apellido se recuperó de lo que escribió el paciente, pero la
      //     respuesta del modelo se escribió antes y se lo vuelve a pedir:
      //     "Camila Rojas" → "Gracias, Camila. ¿Me das tu apellido?". El estado
      //     quedaba bien y el paciente igual tenía que repetirlo.
      if (finalStep !== 'concluido' && apellidoRecuperado && pideApellido(replyText)) {
        this.logger.log('Pregunta por el apellido suprimida: ya venía en el mensaje del paciente.');
        replyText = siguienteDatoPersonal(currentBooking);
      }

      // Un RUT que no pasa la validación no puede quedarse en silencio: el
      // modelo lo dio por bueno y seguiría adelante, y el paciente se enteraría
      // en la clínica. Se le pide de nuevo indicando qué pasó.
      if (rutRechazado) {
        replyText =
          'Ese RUT no me cuadra, creo que hay un dígito cambiado.\n\n' +
          '¿Me lo escribes de nuevo con el dígito verificador? Por ejemplo: 12345678-9';
      }

      // 8. Guardarraíl: el modelo no puede dar por hecha una reserva que el
      //    sistema no ejecutó. Solo executeScheduling confirma, y ese camino ya
      //    sustituye el texto; si llegamos aquí sin 'concluido', la cita no
      //    existe. El prompt ya lo prohíbe, pero una prohibición en el prompt es
      //    probabilística y aquí el coste de fallar es que el paciente se quede
      //    creyendo que tiene una hora que nadie reservó.
      //    PERO reprogramar y cancelar NO pasan por 'listo_para_ejecucion': van
      //    por sus herramientas. Sin esta salvedad el paso real nunca llegaba a
      //    'concluido' en esos casos y la guarda saltaba SIEMPRE, borrando la
      //    respuesta y devolviendo al paciente al flujo de reserva nueva. Uno
      //    que pidió cambiar su hora acabó dando otra vez su nombre y su correo,
      //    y el cambio nunca llegó a hacerse.
      //    Ojo con el matiz: vale que la herramienta se ejecutara CON ÉXITO, no
      //    que se invocara. Comprobar solo la invocación deja pasar el caso
      //    peor: la herramienta responde que la hora ya está ocupada y el
      //    modelo anuncia igualmente "he reprogramado tu hora". El paciente se
      //    va creyendo que la cambió y aparece el día que no es.
      const HERRAMIENTAS_QUE_CAMBIAN = [
        'reschedule_appointment',
        'cancel_appointment',
        'schedule_appointment',
      ];
      const pasos: any[] = Array.isArray((response as any).intermediateSteps)
        ? (response as any).intermediateSteps
        : [];
      const cambioEjecutado = pasos.some((paso) => {
        if (!HERRAMIENTAS_QUE_CAMBIAN.includes(paso?.action?.tool)) return false;
        const salida = String(paso?.observation ?? '');
        return !/^\s*(no se pudo|error|\[simulado\])/i.test(salida);
      });

      // Cambio ya aplicado: lo que toca es confirmarlo, no pedir datos.
      //
      // Tras mover una hora el agente respondía "indícame tu nombre, apellido y
      // correo para la ficha". Los tenía: son los de la cita que acababa de
      // cambiar. El paciente acaba creyendo que el cambio no se hizo y
      // repitiendo datos que ya dio. La regla estaba en el prompt y el modelo
      // la ignoraba, así que pasa a resolverse aquí.
      if (cambioEjecutado && pideDatosPersonales(replyText)) {
        const cita = await this.prisma.appointment.findFirst({
          where: {
            clinicId: params.clinicId,
            ...(params.contact?.id ? { contactId: params.contact.id } : {}),
            status: { notIn: ['CANCELLED'] },
          },
          include: { treatment: true, doctor: true },
          orderBy: { updatedAt: 'desc' },
        });

        if (cita) {
          this.logger.log(
            `Petición de datos personales suprimida: la cita ${cita.id} ya se cambió en este turno.`,
          );
          const conQuien = cita.doctor?.name ? ` con *${cita.doctor.name}*` : '';
          replyText =
            `Listo, tu hora de *${cita.treatment?.name ?? 'atención'}* queda para el ` +
            `*${formatFechaHumana(cita.scheduledAt)}* a las *${format(cita.scheduledAt, 'HH:mm')}*` +
            `${conQuien}.\n\nNo necesito nada más. Si quieres cambiarla otra vez, avísame.`;
        }
      }

      if (finalStep !== 'concluido' && !cambioEjecutado && claimsBookingDone(replyText)) {
        this.logger.error(
          `El modelo anunció una cita no agendada (paso real: ${finalStep}). Respuesta sustituida.`,
        );
        // A quien viene a cambiar o anular su hora, "me falta la fecha para
        // dejar la reserva" no le dice nada: no está reservando.
        const gestionaCitaExistente =
          classification.intent === Intent.REAGENDAR_CITA ||
          classification.intent === Intent.CANCELAR_CITA;

        replyText = gestionaCitaExistente
          ? 'Todavía no pude aplicar el cambio en tu hora.\n\nDime qué día y hora prefieres y lo dejo listo.'
          : buildMissingDataReply(currentBooking);
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
    /**
     * Cita que el paciente está moviendo: su hora actual no cuenta como
     * ocupada. Se añadió a check_availability pero faltaba aquí, y estas son
     * las frases que de verdad lee el paciente: un caso real acabó con "no
     * tiene libre las 14:00" justo después de mover su hora a las 14:00, y la
     * lista de alternativas cambiando en cada vuelta.
     */
    excluirCitaId?: string,
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
        excluirCitaId,
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
        // Decir solo "no puede" obliga al paciente a adivinar la salida. Se
        // miran las dos alternativas reales: otras horas de SU profesional, y
        // qué colega sí tiene justo esa hora.
        const otrosLibres: string[] = [];
        for (const c of candidatos) {
          if (c.id === elegido.id) continue;
          if (await estaLibre(c.id)) otrosLibres.push(c.name);
        }
        const suyas = await this.availabilityTool.getAvailableSlots(
          clinicId,
          scheduledAt,
          treatment.id,
          elegido.id,
          excluirCitaId,
        );

        const conOtro = otrosLibres.length
          ? ` A esa hora sí puede atenderte ${otrosLibres.join(' o ')}.`
          : '';
        const otrasHoras = suyas.length
          ? ` Con ${elegido.name} ese día quedan: ${suyas.slice(0, 5).join(', ')}.`
          : ` Con ${elegido.name} no queda ninguna hora ese día.`;

        return {
          reply: `${elegido.name} no tiene libre las *${hora}*.${conOtro}${otrasHoras} ¿Qué prefieres?`,
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
    // Uno solo libre, o al paciente le da igual: se asigna sin preguntar. Con la
    // pregunta, quien dijo "con el que tenga hora antes" la recibía por tercera
    // vez, ya con todos sus datos entregados.
    if (libres.length === 1 || booking?.doctor_sin_preferencia) {
      return { doctorId: libres[0].id, doctorName: libres[0].name };
    }

    const listado = libres.map((d) => `- ${d.name}`).join('\n');
    return {
      reply: `Para ${treatment.name} a las *${hora}* tengo disponibles a:\n\n${listado}\n\n¿Con cuál prefieres?`,
    };
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

  /** Profesionales activos que atienden un tratamiento. */
  private async especialistasDe(
    clinicId: string,
    treatmentId?: string,
  ): Promise<{ id: string; name: string }[]> {
    if (!treatmentId) return [];
    const rel = await this.prisma.doctorTreatment.findMany({
      where: { clinicId, treatmentId },
      include: { doctor: true },
    });
    return rel
      .filter((dt: any) => dt.doctor && dt.doctor.active !== false)
      .map((dt: any) => ({ id: dt.doctor.id, name: dt.doctor.name }));
  }

  /**
   * Qué pueden ofrecer los DEMÁS especialistas que atienden ese tratamiento.
   *
   * Sirve para que un "no hay" nunca sea un callejón sin salida: si el
   * profesional que el paciente eligió no tiene esa hora, lo útil es saber
   * quién sí la tiene. Con `horaConcreta` responde solo por quienes la tengan
   * libre; sin ella, resume las primeras horas de cada uno.
   */
  private async horasDeOtrosEspecialistas(
    clinicId: string,
    fecha: Date,
    treatmentId: string | undefined,
    doctorElegido: string | undefined,
    candidatos: { id: string; name: string }[],
    horaConcreta?: string,
    excluirCitaId?: string,
  ): Promise<string | null> {
    const otros = candidatos.filter((d) => d.id !== doctorElegido);
    if (!otros.length) return null;

    const partes: string[] = [];
    for (const d of otros) {
      try {
        const libres = await this.availabilityTool.getAvailableSlots(
          clinicId,
          fecha,
          treatmentId,
          d.id,
          excluirCitaId,
        );
        if (!libres.length) continue;

        if (horaConcreta) {
          if (libres.includes(horaConcreta)) partes.push(d.name);
        } else {
          partes.push(`${d.name} (${libres.slice(0, 3).join(', ')})`);
        }
      } catch (e) {
        this.logger.warn(`No se pudo consultar la agenda de ${d.name}: ${(e as Error).message}`);
      }
    }

    return partes.length ? partes.join(' · ') : null;
  }

  private async executeScheduling(
    clinicId: string,
    conversationId: string,
    contact: any,
    booking: any,
  ): Promise<{
    success: boolean;
    reply: string;
    // Adónde volver y qué olvidar cuando la reserva no se pudo ejecutar. Sin
    // esto la conversación se quedaba en 'listo_para_ejecucion' reintentando
    // los mismos datos en cada mensaje y repitiendo la misma frase al paciente.
    retryStep?: ConversationStep;
    clearFields?: string[];
  }> {
    if (!booking?.procedimiento_id) {
      return {
        success: false,
        reply: 'No pude identificar el tratamiento para agendar. ¿Cuál necesitas?',
        retryStep: 'esperando_tratamiento',
      };
    }

    const treatment = await this.prisma.treatment.findFirst({
      where: { id: booking.procedimiento_id, clinicId },
      include: { doctors: { include: { doctor: true } } },
    });
    if (!treatment) {
      return {
        success: false,
        reply: 'No pude encontrar ese tratamiento en el catálogo de la clínica.',
        retryStep: 'esperando_tratamiento',
        clearFields: ['procedimiento_id'],
      };
    }

    const scheduledAt = this.parseBookingDateTime(booking.fecha, booking.hora);
    if (!scheduledAt) {
      return {
        success: false,
        reply: 'La fecha u hora de la cita no son válidas. ¿Podrías confirmarlas?',
        retryStep: 'esperando_fecha',
        clearFields: ['fecha', 'hora'],
      };
    }

    // Una fecha ya pasada solo puede venir de un estado viejo arrastrado. Nunca
    // se la mencionamos al paciente como si la hubiera pedido ahora.
    if (scheduledAt.getTime() < Date.now()) {
      this.logger.warn(
        `Reserva descartada por fecha pasada (${booking.fecha} ${booking.hora}) en la conversación ${conversationId}.`,
      );
      return {
        success: false,
        reply: `¿Para qué día te acomoda la hora de *${treatment.name}*?`,
        retryStep: 'esperando_fecha',
        clearFields: ['fecha', 'hora', 'doctor_id'],
      };
    }

    // Qué cita no debe contar como ocupada.
    //
    // Cuando el paciente pide mover su hora, el agente no siempre toma el
    // camino de reprogramar: a veces intenta reservar de nuevo, y entonces su
    // propia cita bloquea el hueco al que quiere ir. Un paciente real acabó
    // oyendo "no tiene libre las 14:00" justo tras pedir las 14:00, con la
    // lista de alternativas cambiando en cada vuelta. Si cita_id no viene y
    // solo tiene una hora futura, esa es.
    let citaQueSeMueve: string | undefined = booking?.cita_id || undefined;
    if (!citaQueSeMueve && contact?.id) {
      const suyas = await this.prisma.appointment.findMany({
        where: {
          clinicId,
          contactId: contact.id,
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
          scheduledAt: { gte: new Date() },
        },
        select: { id: true },
        take: 2,
      });
      if (suyas.length === 1) citaQueSeMueve = suyas[0].id;
    }

    // Si el tratamiento tiene pregunta propia, no se reserva sin respuesta: la
    // endodoncia de un molar no es la de un incisivo, y el doctor necesita
    // saberlo antes de que el paciente se siente en el sillón.
    if ((treatment as any).extraQuestion && !booking?.respuesta_tratamiento) {
      return {
        success: false,
        reply: `${(treatment as any).extraQuestion}`,
        retryStep: 'esperando_datos_personales',
      };
    }

    const seleccion = await this.selectDoctor(
      clinicId,
      treatment,
      scheduledAt,
      booking,
      citaQueSeMueve,
    );
    if (!seleccion.doctorId) {
      // El especialista o la hora no sirven. Se olvidan ambos para que la
      // respuesta del paciente ("otra hora", "otro especialista") pueda cambiar
      // algo; si se conservan, el siguiente mensaje repite esta misma frase.
      return {
        success: false,
        reply: seleccion.reply!,
        retryStep: 'esperando_horario',
        clearFields: ['hora', 'doctor_id'],
      };
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
      extraAnswer: booking?.respuesta_tratamiento || null,
      paciente: {
        nombre: booking?.Nombre || null,
        apellido: booking?.Apellido || null,
        rut: booking?.rut || null,
        direccion: booking?.direccion || null,
        correo: booking?.correo || null,
      },
    });

    if (!res.success) {
      return {
        success: false,
        reply: `Ese horario ya no está disponible. ¿Quieres que busque otro para ${treatment.name}?`,
        retryStep: 'esperando_horario',
        clearFields: ['hora', 'doctor_id'],
      };
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
        ((res as any)?.appointment?.code
          ? `\n\nTu número de reserva es *${(res as any).appointment.code}*.`
          : '') +
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
/**
 * Recupera el apellido que el paciente escribió y el modelo se dejó.
 *
 * Ante "Miguel Medina, correo@x.com" el modelo guarda Nombre="Miguel",
 * Apellido="" y a continuación pide el apellido: hace repetir al paciente algo
 * que acaba de decir. Ocurre de forma sistemática, no de vez en cuando.
 *
 * Partir un nombre no requiere criterio, así que no se deja al modelo. Solo
 * actúa sobre lo que el PACIENTE escribió, nunca sobre texto del agente, y solo
 * cuando el nombre de pila ya está identificado: así no hay que adivinar dónde
 * empieza el nombre dentro de una frase cualquiera.
 */
export function recuperarApellido(
  nombre: string | undefined,
  textosDelPaciente: string[],
): string {
  const pila = String(nombre || '').trim();
  if (!pila) return '';

  // Si el propio campo ya trae el nombre completo, basta con partirlo.
  const partes = pila.split(/\s+/);
  if (partes.length > 1) return partes.slice(1).join(' ');

  // "Miguel Medina", "Miguel Medina Soto", "miguel medina": el apellido es lo
  // que sigue al nombre de pila. Se admiten dos, que en Chile es lo habitual.
  const escapado = pila.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `\\b${escapado}\\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}(?:\\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,})?)`,
    'i',
  );

  // Del más reciente al más antiguo: si se corrigió, manda lo último que dijo.
  for (const texto of [...textosDelPaciente].reverse()) {
    const m = re.exec(String(texto || ''));
    if (!m) continue;
    const candidato = m[1].trim();
    // Palabras que siguen al nombre pero no son un apellido.
    if (/^(y|es|mi|el|la|con|para|por|correo|email|gracias|soy)\b/i.test(candidato)) continue;
    return candidato;
  }

  return '';
}

/** Familias que razonan antes de responder y solo aceptan su temperatura por defecto. */
function esDeRazonamiento(modelo: string): boolean {
  return /^(gpt-5|o[1-9])/.test(modelo || '');
}

const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Corrige el nombre del día cuando no corresponde a la fecha que lo acompaña.
 *
 * El calendario del prompt evita el error casi siempre, pero "casi" no basta
 * cuando la consecuencia es que alguien se presenta el día equivocado. Se hace
 * que el nombre del día concuerde con el NÚMERO, que es lo que se guarda y lo
 * que determina la hora real. Si el paciente pidió otro día, así lo ve en la
 * respuesta y puede corregirlo; al revés se enteraría al llegar a la consulta.
 */
export function corregirDiaDeSemana(text: string, referencia: Date = new Date()): string {
  if (!text) return text;

  const dias = '(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)';
  const meses = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)';
  const re = new RegExp(`\\b${dias}(\\s+\\d{1,2}\\s+de\\s+${meses})`, 'gi');

  return text.replace(re, (match, _dia, resto) => {
    const m = /(\d{1,2})\s+de\s+([a-zñáéíóú]+)/i.exec(resto);
    if (!m) return match;

    const dia = Number(m[1]);
    const mes = MESES.indexOf(m[2].toLowerCase());
    if (mes < 0 || !dia) return match;

    // Una fecha muy anterior a hoy en el calendario solo puede ser del año que
    // viene: nadie agenda hacia atrás.
    let año = referencia.getFullYear();
    const candidata = new Date(año, mes, dia);
    if (candidata.getTime() < referencia.getTime() - 60 * 24 * 60 * 60 * 1000) {
      año += 1;
    }

    const real = new Date(año, mes, dia);
    if (real.getDate() !== dia || real.getMonth() !== mes) return match;

    return `${DIAS_SEMANA[real.getDay()]}${resto}`;
  });
}

const PALABRAS_POCO_DISTINTIVAS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'para', 'por', 'a',
  'general', 'dental', 'dentales', 'evaluacion', 'control', 'sesion',
  'tratamiento', 'consulta', 'primera', 'simple',
]);

function normalizar(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Tratamientos del catálogo que el PACIENTE nombró con sus propias palabras.
 *
 * El tratamiento se fija hoy haciendo que el modelo copie un UUID de la lista.
 * Copiar identificadores es justo lo que peor se le da, y equivocarse no se nota:
 * el UUID es opaco, así que una cita puede quedar con un tratamiento que nadie
 * pidió sin que ningún paso del flujo lo detecte. Esto permite contrastar esa
 * elección con lo que el paciente dijo de verdad.
 *
 * Solo se miran los mensajes del paciente: lo que el agente haya escrito no es
 * evidencia de nada, y contarlo realimentaría su propio error.
 */
export function tratamientosMencionados(
  textosDelPaciente: string[],
  catalogo: { id: string; name: string }[],
): { id: string; name: string }[] {
  const texto = textosDelPaciente.map(normalizar).join(' \n ');
  if (!texto.trim()) return [];

  const encontrados = new Map<string, { id: string; name: string }>();

  for (const t of catalogo) {
    const nombreNorm = normalizar(t.name);

    // Palabras propias del nombre: "Limpieza Dental" se reconoce por "limpieza",
    // no por "dental", que comparten varios. Se admite el plural.
    const distintivas = nombreNorm
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5 && !PALABRAS_POCO_DISTINTIVAS.has(w));

    const patrones = distintivas.length
      ? distintivas.map((w) => new RegExp(`\\b${w}(es|s)?\\b`))
      : // Sin ninguna palabra propia (p. ej. "Consulta General") solo vale el
        // nombre completo, para no capturar un "consulta" suelto.
        [new RegExp(`\\b${nombreNorm.replace(/[^a-z0-9]+/g, '\\s+')}\\b`)];

    if (patrones.some((re) => re.test(texto))) {
      encontrados.set(t.id, { id: t.id, name: t.name });
    }
  }

  return [...encontrados.values()];
}

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

/**
 * Ofrecimientos que no existen.
 *
 * El agente ofreció "enviarte el comprobante al correo": no hay tal cosa. Es la
 * misma familia que el "en un momento te confirmo" que ya se quitó: promesas
 * que el paciente da por buenas y descubre incumplidas el día de su hora.
 */
const OFRECIMIENTOS_INEXISTENTES = [
  /\s*¿[^?]*\b(comprobante|constancia|resumen|recordatorio|confirmaci[oó]n)\b[^?]*\b(correo|email|mail|whatsapp)\b[^?]*\?/gi,
  /\s*¿[^?]*\b(te (env[ií]o|mando)|quieres que te (env[ií]e|mande))\b[^?]*\b(comprobante|constancia|resumen|copia)\b[^?]*\?/gi,
  /\s*¿[^?]*\b(te llamo|te llamamos|llamarte)\b[^?]*\?/gi,
];

export function quitarOfrecimientosInexistentes(text: string): string {
  if (!text) return text;
  let out = text;
  for (const re of OFRECIMIENTOS_INEXISTENTES) out = out.replace(re, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function sanitizeReply(text: string): string {
  if (!text) return text;
  return quitarOfrecimientosInexistentes(corregirDiaDeSemana(
    limpiarMarkdownNoSoportado(
      text
        .replace(/\bTe gustaría\b/g, 'Quieres')
        .replace(/\bte gustaría\b/g, 'quieres'),
    ),
  ));
}

/**
 * WhatsApp no entiende Markdown estándar: lo enseña tal cual. El prompt ya lo
 * prohíbe, pero una prohibición en el prompt es probabilística y el doble
 * asterisco se coló tres veces, incluida una respuesta con el precio de un
 * tratamiento ("**$148.000**"). Aquí deja de depender de la suerte.
 */
export function limpiarMarkdownNoSoportado(text: string): string {
  if (!text) return text;
  return (
    text
      // Saltos de línea escapados. El modelo redacta dentro de un JSON y a
      // veces deja los dos caracteres de la secuencia en el texto en lugar de
      // un salto real, y al paciente le llegan literales:
      //   "...a las *12:30*.\\n\\n¿Confirmas..."
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, ' ')
      // **negrita** -> *negrita*, que es la de WhatsApp. Se hace antes que nada
      // para no romperla al tocar los asteriscos sueltos.
      .replace(/\*\*([^*\n]+)\*\*/g, '*$1*')
      // ***texto*** y similares: cualquier resto de 3+ asteriscos seguidos.
      .replace(/\*{3,}/g, '*')
      // ### Título -> Título en negrita, que es lo más parecido que hay.
      .replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, '*$1*')
      // [texto](url) -> texto: url. WhatsApp ya hace clicable la URL desnuda.
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1: $2')
      // `código` y ```bloques```: los acentos graves se ven como basura.
      .replace(/```+/g, '')
      .replace(/`([^`\n]+)`/g, '$1')
      // __subrayado__ del Markdown -> cursiva de WhatsApp.
      .replace(/__([^_\n]+)__/g, '_$1_')
  );
}

/** Frases con las que el modelo da por hecha una reserva. Solo afirmaciones:
 *  una pregunta como "¿quieres que te la deje agendada?" no cuenta. */
const BOOKING_CLAIM_PATTERNS = [
  // Reserva nueva
  /\bagendad[oa]\b\s*(para|el|:)/i,
  /\b(qued[oó]|quedar[oó]n|est[aá]|ya est[aá])\s+(agendad[oa]|reservad[oa]|confirmad[oa])/i,
  /\b(tu|su)\s+(hora|cita)\s+(qued[oó]|est[aá]|ya)/i,
  /\breserva\s+(confirmada|realizada|hecha|lista)\b/i,
  // Cambio o anulación de una hora existente. Faltaban: el agente dijo "he
  // reprogramado tu hora" con la herramienta devolviendo que no se había
  // ejecutado, y la frase no encajaba en ningún patrón, así que pasó entera.
  /\b(he|hemos)\s+(reprogramad[oa]|reagendad[oa]|cambiad[oa]|movid[oa]|cancelad[oa]|anulad[oa])\b/i,
  // El "que" delante lo convierte en propuesta, no en hecho consumado:
  // "¿quieres que reprograme tu hora?" no afirma nada.
  /(?<!\bque\s)\b(reprogram[ée]|reagend[ée]|cambi[ée]|mov[ií]|cancel[ée]|anul[ée])\s+(tu|su|la)\b/i,
  /\b(reprogramaci[oó]n|reagendamiento|cambio|cancelaci[oó]n)\s+(realizad[oa]|hech[oa]|confirmad[oa]|list[oa]|exitos[oa])\b/i,
  /\b(tu|su)\s+(hora|cita)\s+(fue|ha sido|qued[oó])\s+(reprogramad[oa]|cambiad[oa]|movid[oa]|cancelad[oa]|anulad[oa])\b/i,
];

/**
 * ¿La respuesta está pidiéndole al paciente que elija especialista?
 *
 * Hace falta porque la regla de "no preguntes si solo hay uno" vive en el
 * prompt, y una regla del prompt es probabilística: el agente seguía ofreciendo
 * listas de una sola opción. Detectarlo permite sustituir la respuesta por la
 * siguiente pregunta de verdad.
 */
/**
 * ¿La respuesta está pidiendo los datos personales del paciente?
 *
 * Hace falta porque tras mover una hora el agente seguía pidiendo nombre,
 * apellido y correo "para la ficha". Ya los tenía: son los de la cita que
 * acababa de cambiar. Al paciente le queda la sensación de que el cambio no se
 * hizo y de que tiene que empezar otra vez.
 */
export function pideDatosPersonales(text: string): boolean {
  const t = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /\b(nombre|apellido|correo|email|mail)\b/.test(t) &&
    /\b(indicame|dame|necesito|me (los|lo|la)|facilitame|entregame|confirmame|cual es|me das|compartes|para la ficha|para completar)\b/.test(t);
}

export function preguntaPorEspecialista(text: string): boolean {
  const t = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!t.includes('?')) return false;

  // Hablar de un profesional y preguntar algo NO es pedir que elija
  // profesional. "La Dra. López no atiende los viernes, ¿prefieres otro día?"
  // encajaba en el patrón y se sustituía por un genérico, tirando a la basura
  // justamente la explicación que el paciente necesitaba.
  const esOtraCosa =
    /\b(no atiende|no trabaja|no tiene libre|ausencia|ya no est|otro dia|otra fecha|otra hora|que dia|que hora)\b/.test(t);
  if (esOtraCosa) return false;

  // La pregunta tiene que ser por CUÁL de ellos, no por cualquier cosa que
  // mencione a un profesional.
  return (
    /\b(con (cual|quien|que)\b|cual de (ellos|los|las)|que (especialista|profesional|doctora?|dentista)\b)/.test(t) ||
    /\b(especialistas?|profesionales?|doctora?s?|dentista)\b[\s\S]{0,40}\b(prefieres|prefiere|eliges|escoges|quieres atenderte)\b/.test(t) ||
    /\b(prefieres|prefiere|eliges|escoges)\b[\s\S]{0,40}\b(especialistas?|profesionales?|doctora?s?|dentista)\b/.test(t)
  );
}

/** Horas sin mensajes a partir de las cuales el paciente empieza una visita nueva. */
export const HORAS_PARA_VISITA_NUEVA = 24;

/**
 * Mensajes de la visita actual: los que siguen al último silencio largo.
 * El historial llega en orden cronológico y su último mensaje es el que el
 * paciente acaba de escribir. Sin fechas en los mensajes no se corta nada.
 */
export function desdeElUltimoSilencio(
  historial: any[] | undefined,
  horas: number,
): { esNueva: boolean; mensajes: any[]; horasDeSilencio: number } {
  const mensajes = historial || [];
  const instante = (m: any) => new Date(m?.sentAt ?? m?.sent_at ?? NaN).getTime();
  for (let i = mensajes.length - 1; i > 0; i--) {
    const actual = instante(mensajes[i]);
    const anterior = instante(mensajes[i - 1]);
    if (Number.isNaN(actual) || Number.isNaN(anterior)) return { esNueva: false, mensajes, horasDeSilencio: 0 };
    const silencio = (actual - anterior) / 3_600_000;
    if (silencio >= horas) {
      // Solo cuenta como visita nueva si el corte es justo antes del mensaje
      // de ahora; un silencio más atrás ya se trató en su momento.
      const esNueva = i === mensajes.length - 1;
      return { esNueva, mensajes: mensajes.slice(i), horasDeSilencio: Math.round(silencio) };
    }
  }
  return { esNueva: false, mensajes, horasDeSilencio: 0 };
}

/** "25/09/2026" o "2026-09-25" → fecha local; cualquier otra cosa → null. */
export function parseFechaReserva(fecha?: string): Date | null {
  const t = String(fecha || '').trim();
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
  return null;
}

function sinAcentos(texto: string): string {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** El mensaje habla de quién atiende: "con quién", "doctor", "la dra", "especialista". */
export function mencionaEspecialista(texto: string): boolean {
  return /\b(con quien|doctora?s?|dra?\.?|especialistas?|profesionales?|dentistas?)\b/.test(sinAcentos(texto));
}

/**
 * "Me da igual", "con el que tenga hora antes", "cualquiera". Solo se mira
 * cuando la conversación está en la elección de especialista, porque fuera de
 * ahí "me da igual" puede referirse a la hora o al día.
 */
export function sinPreferenciaDeEspecialista(texto: string): boolean {
  const t = sinAcentos(texto);
  if (/\bno me da (igual|lo mismo)\b/.test(t)) return false;
  return /\b(me da igual|da igual|me da lo mismo|da lo mismo|(me es )?indiferente|cualquier[ao]?|con quien sea|quien sea|(el|la) que (sea|tenga|este|haya|pueda)|quien tenga|no tengo preferencia|sin preferencia|ningun[ao]? en (particular|especial)|(el|la) primer[ao]? (que|disponible|libre)|(el|la) mas pronto|(el|la) de antes)\b/.test(t);
}

/** La respuesta pide el apellido. */
export function pideApellido(texto: string): boolean {
  const t = sinAcentos(texto);
  return t.includes('?') && /\bapellidos?\b/.test(t);
}

/** Siguiente dato de la ficha que falta, tras tener nombre y apellido. */
export function siguienteDatoPersonal(booking: any): string {
  const b = booking || {};
  const gracias = b.Nombre ? `Gracias, ${b.Nombre}.` : 'Gracias.';
  if (!b.rut) return `${gracias} ¿Me das tu RUT, con el dígito verificador?`;
  if (!b.direccion) return `${gracias} ¿Y tu dirección?`;
  if (!b.correo) return `${gracias} ¿Y tu correo?`;
  return buildMissingDataReply(b);
}

/**
 * Respuesta cuando al paciente le da igual el especialista y el modelo le
 * preguntó con cuál: se sigue con lo que de verdad falta.
 */
export function respuestaSinElegirEspecialista(booking: any): string {
  const b = booking || {};
  if (b.fecha && b.hora) {
    const [d, m, y] = String(b.fecha).split('/').map(Number);
    const fecha = d && m && y ? formatFechaHumana(new Date(y, m - 1, d)) : b.fecha;
    return `Entonces el *${fecha}* a las *${b.hora}*. ¿Me das tu nombre y apellido para reservarla?`;
  }
  if (b.fecha) return '¿A qué hora te acomoda?';
  return '¿Qué día te acomoda?';
}

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
  if (!b.rut) {
    return 'Me falta tu RUT para la ficha.\n\n¿Me lo das con el dígito verificador?';
  }
  if (!b.direccion) {
    return 'Me falta tu dirección para la ficha.\n\n¿Cuál es?';
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
