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
exports.DoctorService = void 0;
const common_1 = require("@nestjs/common");
const shared_prisma_1 = require("@deviaty/shared-prisma");
let DoctorService = class DoctorService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(clinicId, active) {
        return this.prisma.doctor.findMany({
            where: {
                clinicId,
                ...(active !== undefined ? { active } : {}),
            },
            include: {
                treatments: {
                    include: {
                        treatment: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
    }
    async findOne(clinicId, id) {
        const doctor = await this.prisma.doctor.findFirst({
            where: { id, clinicId },
            include: {
                treatments: {
                    include: {
                        treatment: true,
                    },
                },
            },
        });
        if (!doctor) {
            throw new common_1.NotFoundException('Doctor no encontrado');
        }
        return doctor;
    }
    async create(clinicId, dto) {
        const { treatment_ids, ...data } = dto;
        return this.prisma.$transaction(async (tx) => {
            const doctor = await tx.doctor.create({
                data: {
                    ...data,
                    clinicId,
                },
            });
            if (treatment_ids && treatment_ids.length > 0) {
                await tx.doctorTreatment.createMany({
                    data: treatment_ids.map((treatmentId) => ({
                        clinicId,
                        doctorId: doctor.id,
                        treatmentId,
                    })),
                });
            }
            return doctor;
        });
    }
    async update(clinicId, id, dto) {
        const { treatment_ids, ...data } = dto;
        // Verificar existencia
        await this.findOne(clinicId, id);
        return this.prisma.$transaction(async (tx) => {
            const doctor = await tx.doctor.update({
                where: { id },
                data,
            });
            if (treatment_ids !== undefined) {
                // Reemplazar tratamientos (Bulk delete + Create)
                await tx.doctorTreatment.deleteMany({
                    where: { doctorId: id },
                });
                if (treatment_ids.length > 0) {
                    await tx.doctorTreatment.createMany({
                        data: treatment_ids.map((tId) => ({
                            clinicId,
                            doctorId: id,
                            treatmentId: tId,
                        })),
                    });
                }
            }
            return doctor;
        });
    }
    async remove(clinicId, id) {
        await this.findOne(clinicId, id);
        return this.prisma.doctor.update({
            where: { id },
            data: { active: false },
        });
    }
};
exports.DoctorService = DoctorService;
exports.DoctorService = DoctorService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService])
], DoctorService);
//# sourceMappingURL=doctor.service.js.map