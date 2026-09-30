/**
 * RUT chileno y referencia corta de cita.
 *
 * Validar un RUT es aritmética, no criterio: el dígito verificador se calcula.
 * Dejárselo al modelo significaría aceptar RUTs inventados en la ficha clínica,
 * que es justo donde más caro sale un dato falso.
 */

/** "12.345.678-k" -> "12345678-K". Devuelve null si no es un RUT válido. */
export function normalizarRut(valor: string | undefined | null): string | null {
  const limpio = String(valor ?? '')
    .replace(/[.\s]/g, '')
    .replace(/[–—]/g, '-')
    .toUpperCase();

  const m = /^(\d{7,8})-?([\dK])$/.exec(limpio);
  if (!m) return null;

  const cuerpo = m[1];
  const digito = m[2];
  if (calcularDigitoVerificador(cuerpo) !== digito) return null;

  return `${cuerpo}-${digito}`;
}

/** Módulo 11, el algoritmo del dígito verificador chileno. */
export function calcularDigitoVerificador(cuerpo: string): string {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

/**
 * Alfabeto sin caracteres que se confunden al dictar o al leer: 0/O, 1/I/L, 5/S.
 * La referencia se dice por teléfono y se teclea, así que la ambigüedad cuesta.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRTUVWXY2346789';

export function generarCodigoCita(largo = 6): string {
  let out = '';
  for (let i = 0; i < largo; i++) {
    out += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return out;
}

/** Reconoce una referencia dentro de un mensaje: "mi cita D4K7QP", "la D4K7QP". */
export function extraerCodigoCita(texto: string | undefined | null): string | null {
  const t = String(texto ?? '').toUpperCase();
  const m = new RegExp(`\\b([${ALFABETO}]{6})\\b`).exec(t);
  return m ? m[1] : null;
}
