"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentClinicId = exports.CurrentUserId = exports.Auditable = exports.AUDIT_ENTITY_KEY = exports.Public = exports.IS_PUBLIC_KEY = void 0;
const common_1 = require("@nestjs/common");
// Public Decorator
exports.IS_PUBLIC_KEY = 'isPublic';
const Public = () => (0, common_1.SetMetadata)(exports.IS_PUBLIC_KEY, true);
exports.Public = Public;
// Auditable Decorator
exports.AUDIT_ENTITY_KEY = 'auditable_entity';
const Auditable = (entity) => (0, common_1.SetMetadata)(exports.AUDIT_ENTITY_KEY, entity);
exports.Auditable = Auditable;
// User ID Decorator (Helper for controllers)
exports.CurrentUserId = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['x-user-id'];
});
// Clinic ID Decorator (Helper for controllers)
exports.CurrentClinicId = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['x-clinic-id'];
});
//# sourceMappingURL=index.js.map