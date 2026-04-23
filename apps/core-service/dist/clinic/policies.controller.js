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
exports.PoliciesController = void 0;
const common_1 = require("@nestjs/common");
const shared_nestjs_1 = require("@deviaty/shared-nestjs");
const clinic_service_1 = require("./clinic.service");
const clinic_dto_1 = require("./dto/clinic.dto");
let PoliciesController = class PoliciesController {
    clinicService;
    constructor(clinicService) {
        this.clinicService = clinicService;
    }
    async findAll(clinicId) {
        return this.clinicService.getPolicies(clinicId);
    }
    async create(clinicId, dto) {
        return this.clinicService.createPolicy(clinicId, dto);
    }
    async update(clinicId, id, dto) {
        return this.clinicService.updatePolicy(clinicId, id, dto);
    }
    async remove(clinicId, id) {
        return this.clinicService.deletePolicy(clinicId, id);
    }
};
exports.PoliciesController = PoliciesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PoliciesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, shared_nestjs_1.Auditable)('policy'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, clinic_dto_1.CreatePolicyDto]),
    __metadata("design:returntype", Promise)
], PoliciesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, shared_nestjs_1.Auditable)('policy'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, clinic_dto_1.UpdatePolicyDto]),
    __metadata("design:returntype", Promise)
], PoliciesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, shared_nestjs_1.Auditable)('policy'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PoliciesController.prototype, "remove", null);
exports.PoliciesController = PoliciesController = __decorate([
    (0, common_1.Controller)('clinic/policies'),
    __param(0, (0, common_1.Inject)(clinic_service_1.ClinicService)),
    __metadata("design:paramtypes", [clinic_service_1.ClinicService])
], PoliciesController);
//# sourceMappingURL=policies.controller.js.map