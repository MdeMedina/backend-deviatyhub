/**
 * Cálculo de horas libres. Vive aquí porque había DOS implementaciones
 * distintas: la del agente y la de la agenda del panel. Divergían —la del panel
 * ni siquiera miraba qué profesional atiende cada tratamiento— así que lo que
 * veía la clínica en pantalla y lo que el agente le ofrecía a un paciente no
 * tenían por qué coincidir.
 *
 * Recibe el cliente de Prisma como parámetro para no atar este paquete al
 * esquema; se tipa de forma laxa a propósito.
 */
interface Tramo {
    desde: number;
    hasta: number;
}
export declare const aMinutos: (hhmm: string) => number;
/** Intersección de dos listas de tramos. El resultado nunca amplía a ninguna. */
export declare const intersectarTramos: (a: Tramo[], b: Tramo[]) => Tramo[];
export interface AvailabilityOptions {
    /** Excluir las horas ya pasadas cuando la fecha consultada es hoy. */
    excluirPasado?: boolean;
}
export declare function calcularHorasLibres(prisma: any, clinicId: string, date: Date, treatmentId?: string, doctorId?: string, options?: AvailabilityOptions): Promise<string[]>;
export {};
//# sourceMappingURL=availability.util.d.ts.map