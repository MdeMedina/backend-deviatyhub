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
var DoctorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorService = void 0;
const common_1 = require("@nestjs/common");
const shared_prisma_1 = require("@deviaty/shared-prisma");
let DoctorService = DoctorService_1 = class DoctorService {
    prisma;
    logger = new common_1.Logger(DoctorService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
        this.logger.log('DoctorService initialized');
    }
    mapDoctorToFrontend(d) {
        return {
            id: d.id,
            name: d.name,
            title: d.title,
            active: d.active,
            treatments: d.treatments?.map((dt) => ({
                id: dt.treatment.id,
                name: dt.treatment.name,
            })) || [],
        };
    }
    async findAll(clinicId, active) {
        this.logger.log(`findAll - clinicId: ${clinicId}, active: ${active}`);
        const doctors = await this.prisma.doctor.findMany({
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
        return doctors.map((d) => this.mapDoctorToFrontend(d));
    }
    async findOne(clinicId, id) {
        this.logger.log(`findOne - clinicId: ${clinicId}, doctorId: ${id}`);
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
            this.logger.warn(`findOne - Doctor not found. clinicId: ${clinicId}, doctorId: ${id}`);
            throw new common_1.NotFoundException('Doctor no encontrado');
        }
        return this.mapDoctorToFrontend(doctor);
    }
    async create(clinicId, dto) {
        this.logger.log(`create - Creating doctor for clinicId: ${clinicId}, name: ${dto.name}`);
        const { treatment_ids, treatments, ...data } = dto;
        let treatmentIds = treatment_ids;
        if (treatments !== undefined) {
            treatmentIds = treatments.map((t) => typeof t === 'string' ? t : t.id).filter(Boolean);
        }
        const doctor = await this.prisma.$transaction(async (tx) => {
            const created = await tx.doctor.create({
                data: {
                    ...data,
                    clinicId,
                },
            });
            if (treatmentIds && treatmentIds.length > 0) {
                this.logger.log(`create - Linking ${treatmentIds.length} treatments for doctor: ${created.id}`);
                await tx.doctorTreatment.createMany({
                    data: treatmentIds.map((treatmentId) => ({
                        clinicId,
                        doctorId: created.id,
                        treatmentId,
                    })),
                });
            }
            return created;
        });
        return this.findOne(clinicId, doctor.id);
    }
    async update(clinicId, id, dto) {
        this.logger.log(`update - Updating doctor: ${id} under clinicId: ${clinicId}`);
        const { treatment_ids, treatments, ...data } = dto;
        let treatmentIds = treatment_ids;
        if (treatments !== undefined) {
            treatmentIds = treatments.map((t) => typeof t === 'string' ? t : t.id).filter(Boolean);
        }
        // Verificar existencia
        await this.findOne(clinicId, id);
        await this.prisma.$transaction(async (tx) => {
            await tx.doctor.update({
                where: { id },
                data,
            });
            if (treatmentIds !== undefined) {
                this.logger.log(`update - Re-linking treatments for doctor: ${id}. Count: ${treatmentIds.length}`);
                // Reemplazar tratamientos (Bulk delete + Create)
                await tx.doctorTreatment.deleteMany({
                    where: { doctorId: id },
                });
                if (treatmentIds.length > 0) {
                    await tx.doctorTreatment.createMany({
                        data: treatmentIds.map((tId) => ({
                            clinicId,
                            doctorId: id,
                            treatmentId: tId,
                        })),
                    });
                }
            }
        });
        return this.findOne(clinicId, id);
    }
    async remove(clinicId, id) {
        this.logger.log(`remove - Deactivating doctor: ${id} under clinicId: ${clinicId}`);
        await this.findOne(clinicId, id);
        return this.prisma.doctor.update({
            where: { id },
            data: { active: false },
        });
    }
};
exports.DoctorService = DoctorService;
exports.DoctorService = DoctorService = DoctorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService])
], DoctorService);
//# sourceMappingURL=doctor.service.js.map