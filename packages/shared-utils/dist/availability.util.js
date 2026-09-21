"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intersectarTramos = exports.aMinutos = void 0;
exports.calcularHorasLibres = calcularHorasLibres;
const date_fns_1 = require("date-fns");
const aMinutos = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};
exports.aMinutos = aMinutos;
/** Intersección de dos listas de tramos. El resultado nunca amplía a ninguna. */
const intersectarTramos = (a, b) => {
    const out = [];
    for (const x of a) {
        for (const y of b) {
            const desde = Math.max(x.desde, y.desde);
            const hasta = Math.min(x.hasta, y.hasta);
            if (desde < hasta)
                out.push({ desde, hasta });
        }
    }
    return out;
};
exports.intersectarTramos = intersectarTramos;
async function calcularHorasLibres(prisma, clinicId, date, treatmentId, doctorId, options = {}) {
    const { excluirPasado = true } = options;
    // 1. Duración de la reserva
    let durationMin = 30;
    if (treatmentId) {
        const treatment = await prisma.treatment.findUnique({ where: { id: treatmentId } });
        if (treatment?.durationAvgMin)
            durationMin = treatment.durationAvgMin;
    }
    // 2. Profesionales candidatos. Con tratamiento, solo los que lo atienden:
    //    ofrecer una hora de alguien que no hace ese tratamiento es ofrecer nada.
    let doctorIds = [];
    if (doctorId) {
        const doc = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (doc && doc.active !== false)
            doctorIds = [doctorId];
    }
    else if (treatmentId) {
        const docsTr = await prisma.doctorTreatment.findMany({
            where: { clinicId, treatmentId },
            include: { doctor: true },
        });
        doctorIds = docsTr
            .filter((dt) => dt.doctor && dt.doctor.active !== false)
            .map((dt) => dt.doctorId);
    }
    else {
        const activos = await prisma.doctor.findMany({ where: { clinicId, active: true } });
        doctorIds = activos.map((d) => d.id);
    }
    if (doctorIds.length === 0)
        return [];
    // 3. Horario de la clínica: es el límite exterior
    const dayOfWeek = date.getDay();
    const scheduleDb = await prisma.clinicSchedule.findFirst({ where: { clinicId, dayOfWeek } });
    const schedule = scheduleDb || {
        isOpen: dayOfWeek !== 0,
        openTime: '09:00',
        closeTime: '18:00',
    };
    if (!schedule.isOpen)
        return [];
    const tramoClinica = [
        { desde: (0, exports.aMinutos)(schedule.openTime), hasta: (0, exports.aMinutos)(schedule.closeTime) },
    ];
    // 4-6. Bloqueos de clínica, jornadas y ausencias
    const [blocks, jornadas, ausencias, citas] = await Promise.all([
        prisma.unavailabilityBlock.findMany({
            where: { clinicId, active: true, daysOfWeek: { has: dayOfWeek } },
        }),
        prisma.doctorSchedule.findMany({
            where: { clinicId, doctorId: { in: doctorIds }, dayOfWeek, active: true },
        }),
        prisma.doctorAbsence.findMany({
            where: {
                clinicId,
                doctorId: { in: doctorIds },
                startsAt: { lt: (0, date_fns_1.endOfDay)(date) },
                endsAt: { gt: (0, date_fns_1.startOfDay)(date) },
            },
        }),
        prisma.appointment.findMany({
            where: {
                clinicId,
                doctorId: { in: doctorIds },
                scheduledAt: { gte: (0, date_fns_1.startOfDay)(date), lte: (0, date_fns_1.endOfDay)(date) },
                status: { not: 'CANCELLED' },
            },
        }),
    ]);
    // 7. Ventana efectiva de cada profesional. Sin jornada propia se asume el
    //    horario de la clínica, para que quien fue dado de alta antes de existir
    //    esta función siga comportándose igual en vez de quedarse sin horas.
    const ventanaPorDoctor = new Map();
    for (const docId of doctorIds) {
        const propios = jornadas.filter((j) => j.doctorId === docId);
        const base = propios.length
            ? propios.map((j) => ({ desde: (0, exports.aMinutos)(j.startTime), hasta: (0, exports.aMinutos)(j.endTime) }))
            : tramoClinica;
        ventanaPorDoctor.set(docId, (0, exports.intersectarTramos)(base, tramoClinica));
    }
    // 8. Generar y filtrar
    const slots = [];
    const current = new Date(date);
    current.setHours(Math.floor(tramoClinica[0].desde / 60), tramoClinica[0].desde % 60, 0, 0);
    const end = new Date(date);
    end.setHours(Math.floor(tramoClinica[0].hasta / 60), tramoClinica[0].hasta % 60, 0, 0);
    const now = new Date();
    const isToday = (0, date_fns_1.format)(date, 'yyyy-MM-dd') === (0, date_fns_1.format)(now, 'yyyy-MM-dd');
    while (current < end) {
        const slotStart = new Date(current);
        const slotEnd = (0, date_fns_1.addMinutes)(slotStart, durationMin);
        const slotDesde = slotStart.getHours() * 60 + slotStart.getMinutes();
        const slotHasta = slotDesde + durationMin;
        const bloqueado = blocks.some((b) => {
            const bStart = (0, exports.aMinutos)(b.startTime);
            const bEnd = (0, exports.aMinutos)(b.endTime);
            return slotDesde < bEnd && slotHasta > bStart;
        });
        if (!bloqueado) {
            const alguienLibre = doctorIds.some((docId) => {
                const ventana = ventanaPorDoctor.get(docId) || [];
                if (!ventana.some((t) => slotDesde >= t.desde && slotHasta <= t.hasta))
                    return false;
                const ausente = ausencias.some((a) => a.doctorId === docId &&
                    slotStart < new Date(a.endsAt) &&
                    slotEnd > new Date(a.startsAt));
                if (ausente)
                    return false;
                return !citas.some((app) => {
                    if (app.doctorId !== docId)
                        return false;
                    const appStart = new Date(app.scheduledAt);
                    const appEnd = (0, date_fns_1.addMinutes)(appStart, app.durationMin || 30);
                    return slotStart < appEnd && slotEnd > appStart;
                });
            });
            const pasado = excluirPasado && isToday && slotStart <= now;
            if (alguienLibre && !pasado)
                slots.push((0, date_fns_1.format)(slotStart, 'HH:mm'));
        }
        current.setTime(current.getTime() + durationMin * 60 * 1000);
    }
    return slots;
}
//# sourceMappingURL=availability.util.js.map