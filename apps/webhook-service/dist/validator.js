"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMetaSignature = validateMetaSignature;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Valida la firma HMAC SHA-256 proporcionada por Meta
 * @param payload El buffer crudo del cuerpo de la petición
 * @param signature El encabezado 'X-Hub-Signature-256'
 * @param secret El secreto del webhook configurado en Meta
 */
function validateMetaSignature(payload, signature, secret) {
    if (!signature || !secret)
        return false;
    // Meta envía la firma en formato 'sha256={hash}'
    const [algorithm, hash] = signature.split('=');
    if (algorithm !== 'sha256' || !hash)
        return false;
    const expectedHash = crypto_1.default
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    const hashBuffer = Buffer.from(hash);
    const expectedBuffer = Buffer.from(expectedHash);
    if (hashBuffer.length !== expectedBuffer.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(hashBuffer, expectedBuffer);
}
//# sourceMappingURL=validator.js.map