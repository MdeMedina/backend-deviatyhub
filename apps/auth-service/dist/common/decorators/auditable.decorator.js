"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Auditable = exports.AUDIT_ENTITY_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.AUDIT_ENTITY_KEY = 'audit_entity';
/**
 * Decorador para marcar un método como auditable.
 * @param entity Nombre de la entidad que se está afectando (ej: 'user', 'role').
 */
const Auditable = (entity) => (0, common_1.SetMetadata)(exports.AUDIT_ENTITY_KEY, entity);
exports.Auditable = Auditable;
//# sourceMappingURL=auditable.decorator.js.map