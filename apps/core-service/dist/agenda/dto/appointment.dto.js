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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RescheduleDto = exports.UpdateStatusDto = exports.CreateAppointmentDto = exports.AppointmentSourceDto = exports.AppointmentStatusDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var AppointmentStatusDto;
(function (AppointmentStatusDto) {
    AppointmentStatusDto["PENDING"] = "PENDING";
    AppointmentStatusDto["CONFIRMED"] = "CONFIRMED";
    AppointmentStatusDto["RESCHEDULED"] = "RESCHEDULED";
    AppointmentStatusDto["CANCELLED"] = "CANCELLED";
    AppointmentStatusDto["COMPLETED"] = "COMPLETED";
})(AppointmentStatusDto || (exports.AppointmentStatusDto = AppointmentStatusDto = {}));
var AppointmentSourceDto;
(function (AppointmentSourceDto) {
    AppointmentSourceDto["AGENT"] = "AGENT";
    AppointmentSourceDto["HUMAN"] = "HUMAN";
    AppointmentSourceDto["EXTERNAL"] = "EXTERNAL";
})(AppointmentSourceDto || (exports.AppointmentSourceDto = AppointmentSourceDto = {}));
class CreateAppointmentDto {
    contact_id;
    // Si no hay contact_id, requerimos estos
    contact_name;
    contact_phone;
    treatment_id;
    doctor_id;
    scheduled_at;
    source;
    notes;
    conversation_id;
}
exports.CreateAppointmentDto = CreateAppointmentDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateAppointmentDto.prototype, "contact_id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateAppointmentDto.prototype, "contact_name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateAppointmentDto.prototype, "contact_phone", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateAppointmentDto.prototype, "treatment_id", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateAppointmentDto.prototype, "doctor_id", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_transformer_1.Type)(() => Date),
    __metadata("design:type", Date)
], CreateAppointmentDto.prototype, "scheduled_at", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(AppointmentSourceDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateAppointmentDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateAppointmentDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateAppointmentDto.prototype, "conversation_id", void 0);
class UpdateStatusDto {
    status;
    notes;
}
exports.UpdateStatusDto = UpdateStatusDto;
__decorate([
    (0, class_validator_1.IsEnum)(AppointmentStatusDto),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateStatusDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateStatusDto.prototype, "notes", void 0);
class RescheduleDto {
    scheduled_at;
    notes;
}
exports.RescheduleDto = RescheduleDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_transformer_1.Type)(() => Date),
    __metadata("design:type", Date)
], RescheduleDto.prototype, "scheduled_at", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RescheduleDto.prototype, "notes", void 0);
//# sourceMappingURL=appointment.dto.js.map