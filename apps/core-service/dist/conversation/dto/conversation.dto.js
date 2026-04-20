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
exports.ConversationFilterDto = exports.ManualMessageDto = exports.ConversationStatusDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var ConversationStatusDto;
(function (ConversationStatusDto) {
    ConversationStatusDto["OPEN"] = "OPEN";
    ConversationStatusDto["HUMAN_TAKEOVER"] = "HUMAN_TAKEOVER";
    ConversationStatusDto["CLOSED"] = "CLOSED";
})(ConversationStatusDto || (exports.ConversationStatusDto = ConversationStatusDto = {}));
class ManualMessageDto {
    content;
}
exports.ManualMessageDto = ManualMessageDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El contenido del mensaje no puede estar vacío' }),
    __metadata("design:type", String)
], ManualMessageDto.prototype, "content", void 0);
class ConversationFilterDto {
    status;
    channel;
    page = 1;
    limit = 20;
}
exports.ConversationFilterDto = ConversationFilterDto;
__decorate([
    (0, class_validator_1.IsEnum)(ConversationStatusDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ConversationFilterDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ConversationFilterDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ConversationFilterDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ConversationFilterDto.prototype, "limit", void 0);
//# sourceMappingURL=conversation.dto.js.map