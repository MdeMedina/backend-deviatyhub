import * as jwt from 'jsonwebtoken';
/**
 * Firma un token JWT
 * @param payload Datos a incluir en el token
 * @param secret Clave secreta
 * @param expiresIn Tiempo de expiración (ej: '10m', '7d')
 */
export declare function signJWT(payload: string | Buffer | object, secret: jwt.Secret, expiresIn: string): string;
/**
 * Verifica un token JWT
 * @param token Token a verificar
 * @param secret Clave secreta
 */
export declare function verifyJWT<T>(token: string, secret: jwt.Secret): T;
/**
 * Extrae el JTI (JWT ID) de un token sin verificar la firma (útil para blacklist)
 * @param token Token JWT
 */
export declare function extractJTI(token: string): string | undefined;
//# sourceMappingURL=jwt.util.d.ts.map