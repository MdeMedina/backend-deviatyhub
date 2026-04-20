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
exports.ClinicController = void 0;
const common_1 = require("@nestjs/common");
const shared_nestjs_1 = require("../../../../packages/shared-nestjs/dist");
const clinic_service_1 = require("./clinic.service");
const clinic_dto_1 = require("./dto/clinic.dto");
let ClinicController = class ClinicController {
    clinicService;
    constructor(clinicService) {
        this.clinicService = clinicService;
    }
    async getConfig(clinicId) {
        return this.clinicService.getConfig(clinicId);
    }
    async updateConfig(clinicId, dto) {
        return this.clinicService.updateConfig(clinicId, dto);
    }
    async getSchedules(clinicId) {
        return this.clinicService.getSchedules(clinicId);
    }
    async updateSchedules(clinicId, dto) {
        return this.clinicService.updateSchedules(clinicId, dto);
    }
};
exports.ClinicController = ClinicController;
__decorate([
    (0, common_1.Get)('config'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClinicController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Patch)('config'),
    (0, shared_nestjs_1.Auditable)('clinicConfig'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, clinic_dto_1.UpdateClinicConfigDto]),
    __metadata("design:returntype", Promise)
], ClinicController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Get)('schedules'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClinicController.prototype, "getSchedules", null);
__decorate([
    (0, common_1.Put)('schedules'),
    (0, shared_nestjs_1.Auditable)('clinicSchedule'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, clinic_dto_1.UpdateSchedulesDto]),
    __metadata("design:returntype", Promise)
], ClinicController.prototype, "updateSchedules", null);
exports.ClinicController = ClinicController = __decorate([
    (0, common_1.Controller)('clinic'),
    __param(0, (0, common_1.Inject)(clinic_service_1.ClinicService)),
    __metadata("design:paramtypes", [clinic_service_1.ClinicService])
], ClinicController);
//# sourceMappingURL=clinic.controller.js.map