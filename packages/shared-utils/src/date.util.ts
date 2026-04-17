import { formatInTimeZone, toDate } from 'date-fns-tz';
import { 
  parse, 
  isWithinInterval, 
  addMinutes, 
  format, 
  parseISO,
  set
} from 'date-fns';

/**
 * Obtiene la hora actual en una zona horaria específica
 * @param timezone Zona horaria (ej: 'America/Santiago')
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  return toDate(new Date(), { timeZone: timezone });
}

/**
 * Verifica si una fecha está dentro de un horario de atención
 * @param date Fecha a verificar
 * @param openTime Hora de apertura 'HH:mm'
 * @param closeTime Hora de cierre 'HH:mm'
 * @param timezone Zona horaria
 */
export function isWithinSchedule(
  date: Date, 
  openTime: string, 
  closeTime: string, 
  timezone: string
): boolean {
  const currentInTZ = toDate(date, { timeZone: timezone });
  
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  
  const start = set(currentInTZ, { hours: openH, minutes: openM, seconds: 0, milliseconds: 0 });
  const end = set(currentInTZ, { hours: closeH, minutes: closeM, seconds: 0, milliseconds: 0 });
  
  return isWithinInterval(currentInTZ, { start, end });
}

/**
 * Calcula los slots de tiempo disponibles entre dos horas
 * @param openTime Hora inicio 'HH:mm'
 * @param closeTime Hora fin 'HH:mm'
 * @param durationMin Duración en minutos
 */
export function calculateSlots(
  openTime: string, 
  closeTime: string, 
  durationMin: number
): string[] {
  const slots: string[] = [];
  
  let current = parse(openTime, 'HH:mm', new Date());
  const end = parse(closeTime, 'HH:mm', new Date());
  
  while (current < end) {
    slots.push(format(current, 'HH:mm'));
    current = addMinutes(current, durationMin);
  }
  
  return slots;
}

/**
 * Formatea una fecha ISO a un string legible en una zona horaria
 */
export function formatDatetime(iso: string, timezone: string, formatStr: string = 'yyyy-MM-dd HH:mm:ss'): string {
  return formatInTimeZone(parseISO(iso), timezone, formatStr);
}
