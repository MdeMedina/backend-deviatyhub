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
exports.TestPermissionsController = void 0;
const common_1 = require("@nestjs/common");
const permissions_decorator_1 = require("./auth/decorators/permissions.decorator");
let TestPermissionsController = class TestPermissionsController {
    view() {
        return { ok: true };
    }
    edit() {
        return { ok: true };
    }
};
exports.TestPermissionsController = TestPermissionsController;
__decorate([
    (0, common_1.Get)('view'),
    (0, permissions_decorator_1.RequirePermission)('users.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TestPermissionsController.prototype, "view", null);
__decorate([
    (0, common_1.Post)('edit'),
    (0, permissions_decorator_1.RequirePermission)('users.edit'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TestPermissionsController.prototype, "edit", null);
exports.TestPermissionsController = TestPermissionsController = __decorate([
    (0, common_1.Controller)('test-perm')
], TestPermissionsController);
//# sourceMappingURL=test-permissions.controller.js.map