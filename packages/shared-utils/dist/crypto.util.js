"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptAES256 = encryptAES256;
exports.decryptAES256 = decryptAES256;
exports.hashBcrypt = hashBcrypt;
exports.compareBcrypt = compareBcrypt;
const crypto = __importStar(require("crypto"));
const bcrypt = __importStar(require("bcryptjs"));
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
/**
 * Cifra un texto usando AES-256-CBC
 * @param text Texto plano a cifrar
 * @param secretKey Clave secreta (debe tener 32 caracteres)
 */
function encryptAES256(text, secretKey) {
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
function decryptAES256(encryptedText, secretKey) {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
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
async function hashBcrypt(plain) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plain, salt);
}
/**
 * Compara un texto plano con un hash Bcrypt
 * @param plain Texto plano
 * @param hash Hash almacenado
 */
async function compareBcrypt(plain, hash) {
    return bcrypt.compare(plain, hash);
}
//# sourceMappingURL=crypto.util.js.map