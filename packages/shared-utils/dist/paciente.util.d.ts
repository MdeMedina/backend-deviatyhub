/**
 * RUT chileno y referencia corta de cita.
 *
 * Validar un RUT es aritmética, no criterio: el dígito verificador se calcula.
 * Dejárselo al modelo significaría aceptar RUTs inventados en la ficha clínica,
 * que es justo donde más caro sale un dato falso.
 */
/** "12.345.678-k" -> "12345678-K". Devuelve null si no es un RUT válido. */
export declare function normalizarRut(valor: string | undefined | null): string | null;
/** Módulo 11, el algoritmo del dígito verificador chileno. */
export declare function calcularDigitoVerificador(cuerpo: string): string;
export declare function generarCodigoCita(largo?: number): string;
/** Reconoce una referencia dentro de un mensaje: "mi cita D4K7QP", "la D4K7QP". */
export declare function extraerCodigoCita(texto: string | undefined | null): string | null;
//# sourceMappingURL=paciente.util.d.ts.map