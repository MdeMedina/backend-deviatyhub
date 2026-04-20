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
exports.UpdateDoctorDto = exports.CreateDoctorDto = void 0;
const class_validator_1 = require("class-validator");
class CreateDoctorDto {
    name;
    title;
    treatment_ids;
}
exports.CreateDoctorDto = CreateDoctorDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre es obligatorio' }),
    __metadata("design:type", String)
], CreateDoctorDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El título o cargo es obligatorio' }),
    __metadata("design:type", String)
], CreateDoctorDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true, message: 'Los IDs de tratamientos deben ser UUID v4 válidos' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateDoctorDto.prototype, "treatment_ids", void 0);
class UpdateDoctorDto {
    name;
    title;
    treatment_ids;
    active;
}
exports.UpdateDoctorDto = UpdateDoctorDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateDoctorDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateDoctorDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], UpdateDoctorDto.prototype, "treatment_ids", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateDoctorDto.prototype, "active", void 0);
//# sourceMappingURL=doctor.dto.js.map