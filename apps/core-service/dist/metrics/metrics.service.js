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
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const shared_prisma_1 = require("@deviaty/shared-prisma");
const date_fns_1 = require("date-fns");
let MetricsService = class MetricsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSummary(clinicId, period) {
        const days = parseInt(period) || 7;
        const fromDate = (0, date_fns_1.subDays)(new Date(), days);
        // 1. Contador de conversaciones y citas
        const [convCount, appScheduled, appRescheduled, appCancelled] = await Promise.all([
            this.prisma.conversation.count({
                where: { clinicId, startedAt: { gte: fromDate } },
            }),
            this.prisma.metricsEvent.count({
                where: { clinicId, eventType: 'APPOINTMENT_SCHEDULED', createdAt: { gte: fromDate } },
            }),
            this.prisma.metricsEvent.count({
                where: { clinicId, eventType: 'APPOINTMENT_RESCHEDULED', createdAt: { gte: fromDate } },
            }),
            this.prisma.metricsEvent.count({
                where: { clinicId, eventType: 'APPOINTMENT_CANCELLED', createdAt: { gte: fromDate } },
            }),
        ]);
        // 2. Containment Rate (Porcentaje de conversaciones cerradas sin haber pasado por takeover)
        const takeovers = await this.prisma.metricsEvent.count({
            where: { clinicId, eventType: 'HUMAN_TAKEOVER', createdAt: { gte: fromDate } }
        });
        const containmentRate = convCount > 0 ? (convCount - takeovers) / convCount : 1;
        // 3. Distribución de intenciones
        const intentions = await this.prisma.metricsEvent.groupBy({
            by: ['intention'],
            where: {
                clinicId,
                eventType: 'INTENTION_DETECTED',
                createdAt: { gte: fromDate },
                intention: { not: null },
            },
            _count: { _all: true },
        });
        const intentionDistribution = intentions.map((i) => ({
            intention: i.intention,
            count: i._count._all,
            percentage: convCount > 0 ? (i._count._all / convCount) * 100 : 0,
        }));
        // 4. Interacciones por hora (Histograma 24h)
        // Nota: En un entorno de producción real esto se haría con un bucket de tiempo en SQL.
        // Aquí simulamos la agregación por la propiedad hourOfDay registrada en los eventos.
        const hourlyData = await this.prisma.metricsEvent.groupBy({
            by: ['hourOfDay'],
            where: {
                clinicId,
                createdAt: { gte: fromDate },
                hourOfDay: { not: null },
            },
            _count: { _all: true },
        });
        const interactionsByHour = Array.from({ length: 24 }, (_, hour) => {
            const found = hourlyData.find((d) => d.hourOfDay === hour);
            return { hour, count: found?._count._all || 0 };
        });
        return {
            period,
            from: fromDate,
            to: new Date(),
            conversations_attended: convCount,
            containment_rate: parseFloat(containmentRate.toFixed(2)),
            human_takeovers: takeovers,
            appointments_scheduled: appScheduled,
            appointments_rescheduled: appRescheduled,
            appointments_cancelled: appCancelled,
            intentions_distribution: intentionDistribution,
            interactions_by_hour: interactionsByHour,
        };
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map