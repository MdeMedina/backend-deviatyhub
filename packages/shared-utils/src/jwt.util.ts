import * as jwt from 'jsonwebtoken';

/**
 * Firma un token JWT
 * @param payload Datos a incluir en el token
 * @param secret Clave secreta
 * @param expiresIn Tiempo de expiración (ej: '10m', '7d')
 */
export function signJWT(payload: string | Buffer | object, secret: jwt.Secret, expiresIn: string): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as any, algorithm: 'HS256' });
}

/**
 * Verifica un token JWT
 * @param token Token a verificar
 * @param secret Clave secreta
 *
 * Solo se acepta HS256, que es con lo que firma signJWT: así no se puede
 * colar un token con otro algoritmo (ni "none").
 */
export function verifyJWT<T>(token: string, secret: jwt.Secret): T {
  return jwt.verify(token, secret, { algorithms: ['HS256'] }) as T;
}

/**
 * Extrae el JTI (JWT ID) de un token sin verificar la firma (útil para blacklist)
 * @param token Token JWT
 */
export function extractJTI(token: string): string | undefined {
  const decoded = jwt.decode(token) as { jti?: string };
  return decoded?.jti;
}
