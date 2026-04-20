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
exports.DoctorController = void 0;
const common_1 = require("@nestjs/common");
const shared_nestjs_1 = require("../../../../packages/shared-nestjs/dist");
const doctor_service_1 = require("./doctor.service");
const doctor_dto_1 = require("./dto/doctor.dto");
let DoctorController = class DoctorController {
    doctorService;
    constructor(doctorService) {
        this.doctorService = doctorService;
    }
    async findAll(clinicId, active) {
        const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
        return this.doctorService.findAll(clinicId, isActive);
    }
    async findOne(clinicId, id) {
        return this.doctorService.findOne(clinicId, id);
    }
    async create(clinicId, dto) {
        return this.doctorService.create(clinicId, dto);
    }
    async update(clinicId, id, dto) {
        return this.doctorService.update(clinicId, id, dto);
    }
    async remove(clinicId, id) {
        return this.doctorService.remove(clinicId, id);
    }
};
exports.DoctorController = DoctorController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Query)('active')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DoctorController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DoctorController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, shared_nestjs_1.Auditable)('doctor'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, doctor_dto_1.CreateDoctorDto]),
    __metadata("design:returntype", Promise)
], DoctorController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, shared_nestjs_1.Auditable)('doctor'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, doctor_dto_1.UpdateDoctorDto]),
    __metadata("design:returntype", Promise)
], DoctorController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, shared_nestjs_1.Auditable)('doctor'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DoctorController.prototype, "remove", null);
exports.DoctorController = DoctorController = __decorate([
    (0, common_1.Controller)('doctors'),
    __param(0, (0, common_1.Inject)(doctor_service_1.DoctorService)),
    __metadata("design:paramtypes", [doctor_service_1.DoctorService])
], DoctorController);
//# sourceMappingURL=doctor.controller.js.map