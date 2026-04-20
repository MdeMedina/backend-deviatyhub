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
exports.ConversationController = void 0;
const common_1 = require("@nestjs/common");
const shared_nestjs_1 = require("../../../../packages/shared-nestjs/dist");
const conversation_service_1 = require("./conversation.service");
const conversation_dto_1 = require("./dto/conversation.dto");
let ConversationController = class ConversationController {
    conversationService;
    constructor(conversationService) {
        this.conversationService = conversationService;
    }
    async findAll(clinicId, filters) {
        return this.conversationService.findAll(clinicId, filters);
    }
    async findContacts(clinicId, search, page, limit) {
        return this.conversationService.findContacts(clinicId, search, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
    }
    async findOne(clinicId, id) {
        return this.conversationService.findOne(clinicId, id);
    }
    async takeover(clinicId, userId, id) {
        return this.conversationService.takeover(clinicId, id, userId);
    }
    async release(clinicId, id) {
        return this.conversationService.release(clinicId, id);
    }
    async sendMessage(clinicId, userId, id, dto) {
        return this.conversationService.sendManualMessage(clinicId, id, userId, dto.content);
    }
};
exports.ConversationController = ConversationController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, conversation_dto_1.ConversationFilterDto]),
    __metadata("design:returntype", Promise)
], ConversationController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('contacts'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ConversationController.prototype, "findContacts", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConversationController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/takeover'),
    (0, shared_nestjs_1.Auditable)('conversation'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, shared_nestjs_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ConversationController.prototype, "takeover", null);
__decorate([
    (0, common_1.Post)(':id/release'),
    (0, shared_nestjs_1.Auditable)('conversation'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConversationController.prototype, "release", null);
__decorate([
    (0, common_1.Post)(':id/message'),
    (0, shared_nestjs_1.Auditable)('message'),
    __param(0, (0, shared_nestjs_1.CurrentClinicId)()),
    __param(1, (0, shared_nestjs_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, conversation_dto_1.ManualMessageDto]),
    __metadata("design:returntype", Promise)
], ConversationController.prototype, "sendMessage", null);
exports.ConversationController = ConversationController = __decorate([
    (0, common_1.Controller)('conversations'),
    __param(0, (0, common_1.Inject)(conversation_service_1.ConversationService)),
    __metadata("design:paramtypes", [conversation_service_1.ConversationService])
], ConversationController);
//# sourceMappingURL=conversation.controller.js.map