/**
 * Valida la firma HMAC SHA-256 proporcionada por Meta
 * @param payload El buffer crudo del cuerpo de la petición
 * @param signature El encabezado 'X-Hub-Signature-256'
 * @param secret El secreto del webhook configurado en Meta
 */
export declare function validateMetaSignature(payload: string | Buffer, signature: string, secret: string): boolean;
//# sourceMappingURL=validator.d.ts.map