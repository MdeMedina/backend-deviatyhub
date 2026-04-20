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
exports.TreatmentController = void 0;
const common_1 = require("@nestjs/common");
const shared_nestjs_1 = require("../../../../packages/shared-nestjs/dist");
const treatment_service_1 = require("./treatment.service");
const treatment_dto_1 = require("./dto/treatment.dto");
let TreatmentController = class TreatmentController {
    treatmentService;
    constructor(treatmentService) {
        this.treatmentService = treatmentService;
    }
    async getEncyclopedia(category, search) {
        return this.treatmentService.getEncyclopedia(category, search);
    }
    async findAll(clinicId, active) {
        const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
        return this.treatmentService.findAll(clinicId, isActive);
    }
    async findOne(clinicId, id) {
        return this.treatmentService.findOne(clinicId, id);
    }
    async create(clinicId, dto) {
        return this.treatmentService.create(clinicId, dto);
    }
    async update(clinicId, id, dto) {
        return this.treatmentService.update(clinicId, id, dto);
    }
    async remove(clinicId, id) {
        return this.treatmentService.remove(clinicId, id);
    }
    // --- OFFERS ---
    async createOffer(clinicId, id, dto) {
        return this.treatmentService.createOffer(clinicId, id, dto);
    }
    async deleteOffer(clinicId, treatmentId, offerId) {
        return this.treatmentService.deleteOffer(clinicId, treatmentId, offerId);
    }
};
exports.TreatmentController = TreatmentController;
__decorate([
    (0, common_1.Get)('encyclopedia'),
    __param(0, (0, common_1.Query)('category')),
    __param(1, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TreatmentController.prototype, "getEncyclopedia", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Query)('active')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TreatmentController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TreatmentController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, shared_nestjs_1.Auditable)('treatment'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, treatment_dto_1.CreateTreatmentDto]),
    __metadata("design:returntype", Promise)
], TreatmentController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, shared_nestjs_1.Auditable)('treatment'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, treatment_dto_1.UpdateTreatmentDto]),
    __metadata("design:returntype", Promise)
], TreatmentController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, shared_nestjs_1.Auditable)('treatment'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TreatmentController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/offers'),
    (0, shared_nestjs_1.Auditable)('treatmentOffer'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, treatment_dto_1.CreateOfferDto]),
    __metadata("design:returntype", Promise)
], TreatmentController.prototype, "createOffer", null);
__decorate([
    (0, common_1.Delete)(':id/offers/:offerId'),
    (0, shared_nestjs_1.Auditable)('treatmentOffer'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('offerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], TreatmentController.prototype, "deleteOffer", null);
exports.TreatmentController = TreatmentController = __decorate([
    (0, common_1.Controller)('treatments'),
    __param(0, (0, common_1.Inject)(treatment_service_1.TreatmentService)),
    __metadata("design:paramtypes", [treatment_service_1.TreatmentService])
], TreatmentController);
//# sourceMappingURL=treatment.controller.js.map