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
exports.TreatmentService = void 0;
const common_1 = require("@nestjs/common");
const shared_prisma_1 = require("@deviaty/shared-prisma");
let TreatmentService = class TreatmentService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(clinicId, active) {
        return this.prisma.treatment.findMany({
            where: {
                clinicId,
                ...(active !== undefined ? { active } : {}),
            },
            include: {
                offers: {
                    where: { active: true },
                },
                doctors: {
                    include: {
                        doctor: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
    }
    async findOne(clinicId, id) {
        const treatment = await this.prisma.treatment.findFirst({
            where: { id, clinicId },
            include: {
                offers: true,
                doctors: {
                    include: {
                        doctor: true,
                    },
                },
            },
        });
        if (!treatment) {
            throw new common_1.NotFoundException('Tratamiento no encontrado');
        }
        return treatment;
    }
    async create(clinicId, dto) {
        const { doctor_ids, ...data } = dto;
        return this.prisma.$transaction(async (tx) => {
            const treatment = await tx.treatment.create({
                data: {
                    ...data,
                    clinicId,
                },
            });
            if (doctor_ids && doctor_ids.length > 0) {
                await tx.doctorTreatment.createMany({
                    data: doctor_ids.map((doctorId) => ({
                        clinicId,
                        doctorId,
                        treatmentId: treatment.id,
                    })),
                });
            }
            return treatment;
        });
    }
    async update(clinicId, id, dto) {
        const { doctor_ids, ...data } = dto;
        await this.findOne(clinicId, id);
        return this.prisma.$transaction(async (tx) => {
            const treatment = await tx.treatment.update({
                where: { id },
                data,
            });
            if (doctor_ids !== undefined) {
                await tx.doctorTreatment.deleteMany({
                    where: { treatmentId: id },
                });
                if (doctor_ids.length > 0) {
                    await tx.doctorTreatment.createMany({
                        data: doctor_ids.map((dId) => ({
                            clinicId,
                            doctorId: dId,
                            treatmentId: id,
                        })),
                    });
                }
            }
            return treatment;
        });
    }
    async remove(clinicId, id) {
        await this.findOne(clinicId, id);
        return this.prisma.treatment.update({
            where: { id },
            data: { active: false },
        });
    }
    // --- OFFERS ---
    async createOffer(clinicId, treatmentId, dto) {
        await this.findOne(clinicId, treatmentId);
        return this.prisma.treatmentOffer.create({
            data: {
                ...dto,
                treatmentId,
                clinicId,
            },
        });
    }
    async deleteOffer(clinicId, treatmentId, offerId) {
        const offer = await this.prisma.treatmentOffer.findFirst({
            where: { id: offerId, treatmentId, clinicId },
        });
        if (!offer)
            throw new common_1.NotFoundException('Oferta no encontrada');
        return this.prisma.treatmentOffer.update({
            where: { id: offerId },
            data: { active: false },
        });
    }
    // --- ENCYCLOPEDIA ---
    async getEncyclopedia(category, search) {
        return this.prisma.dentalEntry.findMany({
            where: {
                ...(category ? { category } : {}),
                ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
            },
        });
    }
};
exports.TreatmentService = TreatmentService;
exports.TreatmentService = TreatmentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService])
], TreatmentService);
//# sourceMappingURL=treatment.service.js.map