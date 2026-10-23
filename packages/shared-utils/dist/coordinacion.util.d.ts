/**
 * Coordinación con la agenda oficial de la clínica (Dentalink).
 *
 * En las clínicas con Dentalink manda la agenda de Dentalink: cada día se trae
 * a Dentral. Lo que se agenda, mueve o anula desde Dentral (por el agente en el
 * chat o desde el panel) no llega solo a Dentalink: lo tiene que repetir el
 * personal. Hasta que lo hace, la cita queda "pendiente" con la acción por
 * hacer, y la sincronización la da por "coordinada" cuando ve el cambio allí.
 */
export type AccionCoordinacion = 'crear' | 'mover' | 'anular';
export interface EstadoCoordinacion {
    coordination: 'pendiente' | 'coordinada' | null;
    coordinationAction: AccionCoordinacion | null;
    coordinatedAt?: Date | null;
    coordinatedBy?: string | null;
}
interface CitaConCoordinacion {
    externalId?: string | null;
    coordination?: string | null;
    coordinationAction?: string | null;
}
/** ¿La clínica trabaja con Dentalink como agenda oficial? */
export declare function usaDentalink(prisma: any, clinicId: string): Promise<boolean>;
/**
 * Qué queda por hacer en Dentalink después de un cambio hecho en Dentral.
 * Devuelve los campos a guardar en la cita.
 */
export declare function coordinacionTrasCambio(cambio: 'crear' | 'mover' | 'anular', cita?: CitaConCoordinacion | null): EstadoCoordinacion;
/** Texto para el personal: qué tiene que hacer en Dentalink. */
export declare function textoAccionCoordinacion(accion?: string | null): string;
export {};
//# sourceMappingURL=coordinacion.util.d.ts.map