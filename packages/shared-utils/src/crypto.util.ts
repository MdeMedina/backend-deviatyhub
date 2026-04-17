import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Cifra un texto usando AES-256-CBC
 * @param text Texto plano a cifrar
 * @param secretKey Clave secreta (debe tener 32 caracteres)
 */
export function encryptAES256(text: string, secretKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.createHash('sha256').update(String(secretKey)).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Descifra un texto cifrado con AES-256-CBC
 * @param encryptedText Texto cifrado en formato iv:encrypted
 * @param secretKey Clave secreta (debe tener 32 caracteres)
 */
export function decryptAES256(encryptedText: string, secretKey: string): string {
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encrypted = Buffer.from(textParts.join(':'), 'hex');
  
  const key = crypto.createHash('sha256').update(String(secretKey)).digest();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString();
}

/**
 * Genera un hash Bcrypt para un texto plano
 * @param plain Texto plano (password)
 */
export async function hashBcrypt(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

/**
 * Compara un texto plano con un hash Bcrypt
 * @param plain Texto plano
 * @param hash Hash almacenado
 */
export async function compareBcrypt(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
