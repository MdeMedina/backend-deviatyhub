/**
 * Verifica si un string es un UUID válido
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Sanitiza los cambios para auditoría, eliminando claves sensibles
 * @param before Objeto previo
 * @param after Objeto nuevo
 * @param sensitiveKeys Claves a omitir (ej: 'password_hash')
 */
export function sanitizeAuditChanges(
  before: any, 
  after: any, 
  sensitiveKeys: string[]
): { before: any; after: any } {
  const sanitize = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
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
