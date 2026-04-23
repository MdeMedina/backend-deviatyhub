import crypto from 'crypto';

/**
 * Valida la firma HMAC SHA-256 proporcionada por Meta
 * @param payload El buffer crudo del cuerpo de la petición
 * @param signature El encabezado 'X-Hub-Signature-256'
 * @param secret El secreto del webhook configurado en Meta
 */
export function validateMetaSignature(payload: string | Buffer, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;

  // Meta envía la firma en formato 'sha256={hash}'
  const [algorithm, hash] = signature.split('=');
  if (algorithm !== 'sha256' || !hash) return false;

  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const hashBuffer = Buffer.from(hash);
  const expectedBuffer = Buffer.from(expectedHash);

  if (hashBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, expectedBuffer);
}
