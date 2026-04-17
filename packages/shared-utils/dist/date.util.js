"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentTimeInTimezone = getCurrentTimeInTimezone;
exports.isWithinSchedule = isWithinSchedule;
exports.calculateSlots = calculateSlots;
exports.formatDatetime = formatDatetime;
const date_fns_tz_1 = require("date-fns-tz");
const date_fns_1 = require("date-fns");
/**
 * Obtiene la hora actual en una zona horaria específica
 * @param timezone Zona horaria (ej: 'America/Santiago')
 */
function getCurrentTimeInTimezone(timezone) {
    return (0, date_fns_tz_1.toDate)(new Date(), { timeZone: timezone });
}
/**
 * Verifica si una fecha está dentro de un horario de atención
 * @param date Fecha a verificar
 * @param openTime Hora de apertura 'HH:mm'
 * @param closeTime Hora de cierre 'HH:mm'
 * @param timezone Zona horaria
 */
function isWithinSchedule(date, openTime, closeTime, timezone) {
    const currentInTZ = (0, date_fns_tz_1.toDate)(date, { timeZone: timezone });
    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const start = (0, date_fns_1.set)(currentInTZ, { hours: openH, minutes: openM, seconds: 0, milliseconds: 0 });
    const end = (0, date_fns_1.set)(currentInTZ, { hours: closeH, minutes: closeM, seconds: 0, milliseconds: 0 });
    return (0, date_fns_1.isWithinInterval)(currentInTZ, { start, end });
}
/**
 * Calcula los slots de tiempo disponibles entre dos horas
 * @param openTime Hora inicio 'HH:mm'
 * @param closeTime Hora fin 'HH:mm'
 * @param durationMin Duración en minutos
 */
function calculateSlots(openTime, closeTime, durationMin) {
    const slots = [];
    let current = (0, date_fns_1.parse)(openTime, 'HH:mm', new Date());
    const end = (0, date_fns_1.parse)(closeTime, 'HH:mm', new Date());
    while (current < end) {
        slots.push((0, date_fns_1.format)(current, 'HH:mm'));
        current = (0, date_fns_1.addMinutes)(current, durationMin);
    }
    return slots;
}
/**
 * Formatea una fecha ISO a un string legible en una zona horaria
 */
function formatDatetime(iso, timezone, formatStr = 'yyyy-MM-dd HH:mm:ss') {
    return (0, date_fns_tz_1.formatInTimeZone)((0, date_fns_1.parseISO)(iso), timezone, formatStr);
}
//# sourceMappingURL=date.util.js.map