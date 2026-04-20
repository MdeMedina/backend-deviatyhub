"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgendaService = void 0;
const common_1 = require("@nestjs/common");
const shared_prisma_1 = require("@deviaty/shared-prisma");
const shared_utils_1 = require("@deviaty/shared-utils");
const date_fns_1 = require("date-fns");
let AgendaService = class AgendaService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAvailableSlots(clinicId, date, treatmentId, doctorId) {
        const targetDate = (0, date_fns_1.parseISO)(date);
        const dayOfWeek = (0, date_fns_1.getDay)(targetDate); // 0 (Dom) a 6 (Sab)
        // 1. Obtener horario de la clínica para ese día
        const schedule = await this.prisma.clinicSchedule.findFirst({
            where: { clinicId, dayOfWeek, isOpen: true },
        });
        if (!schedule) {
            return []; // Clínica cerrada
        }
        // 2. Obtener duración del tratamiento (o default 30 min)
        let duration = 30;
        if (treatmentId) {
            const treatment = await this.prisma.treatment.findUnique({
                where: { id: treatmentId },
            });
            if (treatment?.durationAvgMin) {
                duration = treatment.durationAvgMin;
            }
        }
        // 3. Generar slots base
        const baseSlots = (0, shared_utils_1.calculateSlots)(schedule.openTime, schedule.closeTime, duration);
        // 4. Obtener bloqueos de no disponibilidad globales
        const blocks = await this.prisma.unavailabilityBlock.findMany({
            where: {
                clinicId,
                active: true,
                daysOfWeek: { has: dayOfWeek },
            },
        });
        // 5. Obtener citas agendadas para ese día
        // Consideramos citas que intersecten con el horario de apertura
        const appointments = await this.prisma.appointment.findMany({
            where: {
                clinicId,
                scheduledAt: {
                    gte: new Date(`${date}T00:00:00Z`),
                    lte: new Date(`${date}T23:59:59Z`),
                },
                status: { notIn: ['CANCELLED'] },
                ...(doctorId ? { doctorId } : {}),
            },
        });
        // 6. Filtrar slots
        return baseSlots.filter((slotTime) => {
            const [slotH, slotM] = slotTime.split(':').map(Number);
            // Filtrar por bloques de no disponibilidad
            const isBlocked = blocks.some((block) => {
                const [startH, startM] = block.startTime.split(':').map(Number);
                const [endH, endM] = block.endTime.split(':').map(Number);
                const slotVal = slotH * 60 + slotM;
                const startVal = startH * 60 + startM;
                const endVal = endH * 60 + endM;
                return slotVal >= startVal && slotVal < endVal;
            });
            if (isBlocked)
                return false;
            // Filtrar por citas agendadas
            const isBooked = appointments.some((app) => {
                const appTime = (0, date_fns_1.format)(app.scheduledAt, 'HH:mm');
                const appDuration = app.durationMin;
                const slotVal = slotH * 60 + slotM;
                const [appH, appM] = appTime.split(':').map(Number);
                const appStartVal = appH * 60 + appM;
                const appEndVal = appStartVal + appDuration;
                // El slot colisiona si empieza dentro de una cita existente
                return slotVal >= appStartVal && slotVal < appEndVal;
            });
            if (isBooked)
                return false;
            return true;
        }).map(time => ({
            time,
            available: true
        }));
    }
};
exports.AgendaService = AgendaService;
exports.AgendaService = AgendaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService])
], AgendaService);
//# sourceMappingURL=agenda.service.js.map