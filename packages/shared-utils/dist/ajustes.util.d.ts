/**
 * Ajustes del agente de una clínica (agent_configs.settings). Los fija el
 * equipo de la plataforma en el alta. Sin ajustes, el agente se comporta como
 * siempre: tutea, reserva desde hoy sin tope y manda los tres recordatorios.
 */
export interface AjustesAgente {
    /** Nombre con el que se presenta. Vacío: "la recepcionista virtual". */
    nombre: string;
    trato: 'tu' | 'usted';
    /** Días mínimos entre hoy y la hora reservada. 0 = se puede reservar para hoy. */
    anticipacionMinDias: number;
    /** Días máximos hacia adelante. null = sin tope. */
    anticipacionMaxDias: number | null;
    /** Un paciente nuevo solo puede agendar la evaluación inicial. */
    evaluacionPrimero: boolean;
    /** Una segunda evaluación (paciente que ya vino) se reserva con abono. */
    abonoEvaluacionRepetida: boolean;
    recordatorios: {
        /** Horas antes de la cita en que se avisa: 72, 24 y/o 2. */
        horas: number[];
        /** El recordatorio pide que el paciente confirme su asistencia. */
        pedirConfirmacion: boolean;
    };
    /** Cuándo hay alguien del equipo para responder, en palabras ("lunes a viernes de 9:00 a 18:00"). */
    atencionHumana: string;
}
export declare const HORAS_DE_RECORDATORIO: readonly [72, 24, 2];
export declare function ajustesDelAgente(json: unknown): AjustesAgente;
/**
 * Pasa a "usted" un texto escrito tuteando. Es para los mensajes que arma el
 * propio sistema (confirmaciones, avisos, recordatorios, correcciones del
 * guardarraíl), que están escritos de tú: en una clínica que trata de usted,
 * un "¿Me das tu RUT?" en medio de una conversación de usted desentona.
 * Sobre un texto que ya está de usted no cambia nada.
 */
export declare function adaptarTrato(texto: string, trato: 'tu' | 'usted'): string;
/** ¿Cabe esa fecha dentro de la anticipación de la clínica? Devuelve el motivo si no. */
export declare function fueraDeAnticipacion(fecha: Date, ajustes: Pick<AjustesAgente, 'anticipacionMinDias' | 'anticipacionMaxDias'>, hoy?: Date): string | null;
//# sourceMappingURL=ajustes.util.d.ts.map