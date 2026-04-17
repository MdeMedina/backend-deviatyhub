"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidUUID = isValidUUID;
exports.sanitizeAuditChanges = sanitizeAuditChanges;
/**
 * Verifica si un string es un UUID válido
 */
function isValidUUID(value) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}
/**
 * Sanitiza los cambios para auditoría, eliminando claves sensibles
 * @param before Objeto previo
 * @param after Objeto nuevo
 * @param sensitiveKeys Claves a omitir (ej: 'password_hash')
 */
function sanitizeAuditChanges(before, after, sensitiveKeys) {
    const sanitize = (obj) => {
        if (!obj || typeof obj !== 'object')
            return obj;
        const newObj = { ...obj };
        for (const key of sensitiveKeys) {
            delete newObj[key];
        }
        return newObj;
    };
    return {
        before: sanitize(before),
        after: sanitize(after)
    };
}
//# sourceMappingURL=validate.util.js.map