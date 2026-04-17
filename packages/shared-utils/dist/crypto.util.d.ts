/**
 * Cifra un texto usando AES-256-CBC
 * @param text Texto plano a cifrar
 * @param secretKey Clave secreta (debe tener 32 caracteres)
 */
export declare function encryptAES256(text: string, secretKey: string): string;
/**
 * Descifra un texto cifrado con AES-256-CBC
 * @param encryptedText Texto cifrado en formato iv:encrypted
 * @param secretKey Clave secreta (debe tener 32 caracteres)
 */
export declare function decryptAES256(encryptedText: string, secretKey: string): string;
/**
 * Genera un hash Bcrypt para un texto plano
 * @param plain Texto plano (password)
 */
export declare function hashBcrypt(plain: string): Promise<string>;
/**
 * Compara un texto plano con un hash Bcrypt
 * @param plain Texto plano
 * @param hash Hash almacenado
 */
export declare function compareBcrypt(plain: string, hash: string): Promise<boolean>;
//# sourceMappingURL=crypto.util.d.ts.map