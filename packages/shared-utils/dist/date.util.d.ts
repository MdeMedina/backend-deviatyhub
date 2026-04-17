/**
 * Obtiene la hora actual en una zona horaria específica
 * @param timezone Zona horaria (ej: 'America/Santiago')
 */
export declare function getCurrentTimeInTimezone(timezone: string): Date;
/**
 * Verifica si una fecha está dentro de un horario de atención
 * @param date Fecha a verificar
 * @param openTime Hora de apertura 'HH:mm'
 * @param closeTime Hora de cierre 'HH:mm'
 * @param timezone Zona horaria
 */
export declare function isWithinSchedule(date: Date, openTime: string, closeTime: string, timezone: string): boolean;
/**
 * Calcula los slots de tiempo disponibles entre dos horas
 * @param openTime Hora inicio 'HH:mm'
 * @param closeTime Hora fin 'HH:mm'
 * @param durationMin Duración en minutos
 */
export declare function calculateSlots(openTime: string, closeTime: string, durationMin: number): string[];
/**
 * Formatea una fecha ISO a un string legible en una zona horaria
 */
export declare function formatDatetime(iso: string, timezone: string, formatStr?: string): string;
//# sourceMappingURL=date.util.d.ts.map