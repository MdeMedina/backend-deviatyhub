/**
 * Verifica si un string es un UUID válido
 */
export declare function isValidUUID(value: string): boolean;
/**
 * Sanitiza los cambios para auditoría, eliminando claves sensibles
 * @param before Objeto previo
 * @param after Objeto nuevo
 * @param sensitiveKeys Claves a omitir (ej: 'password_hash')
 */
export declare function sanitizeAuditChanges(before: any, after: any, sensitiveKeys: string[]): {
    before: any;
    after: any;
};
//# sourceMappingURL=validate.util.d.ts.map