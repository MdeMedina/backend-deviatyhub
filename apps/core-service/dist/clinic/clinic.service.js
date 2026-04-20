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
exports.ClinicService = void 0;
const common_1 = require("@nestjs/common");
const shared_prisma_1 = require("@deviaty/shared-prisma");
let ClinicService = class ClinicService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    // --- CONFIG ---
    async getConfig(clinicId) {
        const config = await this.prisma.clinicConfig.findUnique({
            where: { clinicId },
        });
        if (!config)
            throw new common_1.NotFoundException('Clinic configuration not found');
        return config;
    }
    async updateConfig(clinicId, dto) {
        return this.prisma.clinicConfig.upsert({
            where: { clinicId },
            create: {
                clinicId,
                name: dto.name || 'Nueva Clínica',
                address: dto.address || '',
                phone: dto.phone || '',
                email: dto.email || '',
                timezone: dto.timezone || 'UTC',
                language: dto.language || 'es',
            },
            update: {
                ...dto,
            },
        });
    }
    // --- SCHEDULES ---
    async getSchedules(clinicId) {
        return this.prisma.clinicSchedule.findMany({
            where: { clinicId },
            orderBy: { dayOfWeek: 'asc' },
        });
    }
    async updateSchedules(clinicId, dto) {
        // Usamos una transacción para resetear y actualizar los horarios
        return this.prisma.$transaction(async (tx) => {
            await tx.clinicSchedule.deleteMany({ where: { clinicId } });
            const data = dto.schedules.map((s) => ({
                clinicId,
                dayOfWeek: s.day_of_week,
                openTime: s.open_time,
                closeTime: s.close_time,
                isOpen: s.is_open ?? true,
            }));
            await tx.clinicSchedule.createMany({ data });
            return { message: 'Horarios actualizados correctamente' };
        });
    }
    // --- UNAVAILABILITY ---
    async getUnavailability(clinicId) {
        return this.prisma.unavailabilityBlock.findMany({
            where: { clinicId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createUnavailability(clinicId, dto) {
        return this.prisma.unavailabilityBlock.create({
            data: {
                clinicId,
                name: dto.name,
                daysOfWeek: dto.days_of_week,
                startTime: dto.start_time,
                endTime: dto.end_time,
            },
        });
    }
    async updateUnavailability(clinicId, id, dto) {
        return this.prisma.unavailabilityBlock.update({
            where: { id, clinicId },
            data: {
                name: dto.name,
                daysOfWeek: dto.days_of_week,
                startTime: dto.start_time,
                endTime: dto.end_time,
                active: dto.active,
            },
        });
    }
    async deleteUnavailability(clinicId, id) {
        await this.prisma.unavailabilityBlock.delete({
            where: { id, clinicId },
        });
        return { message: 'Bloque eliminado correctamente' };
    }
    // --- POLICIES ---
    async getPolicies(clinicId) {
        return this.prisma.policy.findMany({
            where: { clinicId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createPolicy(clinicId, dto) {
        return this.prisma.policy.create({
            data: {
                clinicId,
                title: dto.title,
                description: dto.description,
            },
        });
    }
    async updatePolicy(clinicId, id, dto) {
        return this.prisma.policy.update({
            where: { id, clinicId },
            data: {
                title: dto.title,
                description: dto.description,
                active: dto.active,
            },
        });
    }
    async deletePolicy(clinicId, id) {
        await this.prisma.policy.delete({
            where: { id, clinicId },
        });
        return { message: 'Política eliminada correctamente' };
    }
};
exports.ClinicService = ClinicService;
exports.ClinicService = ClinicService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService])
], ClinicService);
//# sourceMappingURL=clinic.service.js.map