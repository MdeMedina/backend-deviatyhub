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
exports.AgendaController = void 0;
const common_1 = require("@nestjs/common");
const shared_nestjs_1 = require("@deviaty/shared-nestjs");
const agenda_service_1 = require("./agenda.service");
const appointment_dto_1 = require("./dto/appointment.dto");
let AgendaController = class AgendaController {
    agendaService;
    constructor(agendaService) {
        this.agendaService = agendaService;
    }
    async getSlots(clinicId, date, treatmentId, doctorId) {
        return this.agendaService.getAvailableSlots(clinicId, date, treatmentId, doctorId);
    }
    async findAll(clinicId, from, to, doctorId) {
        return this.agendaService.findAllAppointments(clinicId, from, to, doctorId);
    }
    async findOne(clinicId, id) {
        return this.agendaService.findOneAppointment(clinicId, id);
    }
    async create(clinicId, dto) {
        return this.agendaService.createAppointment(clinicId, dto);
    }
    async updateStatus(clinicId, id, dto) {
        return this.agendaService.updateStatus(clinicId, id, dto.status, dto.notes);
    }
    async reschedule(clinicId, id, dto) {
        return this.agendaService.reschedule(clinicId, id, dto.scheduled_at, dto.notes);
    }
};
exports.AgendaController = AgendaController;
__decorate([
    (0, common_1.Get)('slots'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Query)('date')),
    __param(2, (0, common_1.Query)('treatment_id')),
    __param(3, (0, common_1.Query)('doctor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AgendaController.prototype, "getSlots", null);
__decorate([
    (0, common_1.Get)('appointments'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('doctor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AgendaController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('appointments/:id'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AgendaController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)('appointments'),
    (0, shared_nestjs_1.Auditable)('appointment'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, appointment_dto_1.CreateAppointmentDto]),
    __metadata("design:returntype", Promise)
], AgendaController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)('appointments/:id/status'),
    (0, shared_nestjs_1.Auditable)('appointment'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, appointment_dto_1.UpdateStatusDto]),
    __metadata("design:returntype", Promise)
], AgendaController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Patch)('appointments/:id/reschedule'),
    (0, shared_nestjs_1.Auditable)('appointment'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, appointment_dto_1.RescheduleDto]),
    __metadata("design:returntype", Promise)
], AgendaController.prototype, "reschedule", null);
exports.AgendaController = AgendaController = __decorate([
    (0, common_1.Controller)('agenda'),
    __param(0, (0, common_1.Inject)(agenda_service_1.AgendaService)),
    __metadata("design:paramtypes", [agenda_service_1.AgendaService])
], AgendaController);
//# sourceMappingURL=agenda.controller.js.map