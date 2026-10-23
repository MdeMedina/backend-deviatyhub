"use strict";
/**
 * Coordinación con la agenda oficial de la clínica (Dentalink).
 *
 * En las clínicas con Dentalink manda la agenda de Dentalink: cada día se trae
 * a Dentral. Lo que se agenda, mueve o anula desde Dentral (por el agente en el
 * chat o desde el panel) no llega solo a Dentalink: lo tiene que repetir el
 * personal. Hasta que lo hace, la cita queda "pendiente" con la acción por
 * hacer, y la sincronización la da por "coordinada" cuando ve el cambio allí.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.usaDentalink = usaDentalink;
exports.coordinacionTrasCambio = coordinacionTrasCambio;
exports.textoAccionCoordinacion = textoAccionCoordinacion;
/** ¿La clínica trabaja con Dentalink como agenda oficial? */
async function usaDentalink(prisma, clinicId) {
    const integracion = await prisma.clinicIntegration.findUnique({
        where: { clinicId_type: { clinicId, type: 'DENTALINK' } },
        select: { connected: true },
    });
    return integracion?.connected === true;
}
/**
 * Qué queda por hacer en Dentalink después de un cambio hecho en Dentral.
 * Devuelve los campos a guardar en la cita.
 */
function coordinacionTrasCambio(cambio, cita) {
    const pendiente = (accion) => ({
        coordination: 'pendiente',
        coordinationAction: accion,
        coordinatedAt: null,
        coordinatedBy: null,
    });
    if (cambio === 'crear')
        return pendiente('crear');
    // ¿Existe ya en Dentalink? Sí si vino de allí, si la sincronización la
    // encontró o si alguien la marcó como pasada.
    const estaEnDentalink = !!cita?.externalId ||
        cita?.coordination === 'coordinada' ||
        (cita?.coordination === 'pendiente' && cita?.coordinationAction !== 'crear');
    if (cambio === 'mover') {
        // Si aún no se había pasado, sigue siendo "crear", ahora en la hora nueva.
        return pendiente(estaEnDentalink ? 'mover' : 'crear');
    }
    // Anular algo que nunca llegó a Dentalink no deja nada por hacer.
    if (!estaEnDentalink) {
        return { coordination: null, coordinationAction: null, coordinatedAt: null, coordinatedBy: null };
    }
    return pendiente('anular');
}
/** Texto para el personal: qué tiene que hacer en Dentalink. */
function textoAccionCoordinacion(accion) {
    switch (accion) {
        case 'mover':
            return 'Mover en Dentalink';
        case 'anular':
            return 'Anular en Dentalink';
        default:
            return 'Agendar en Dentalink';
    }
}
//# sourceMappingURL=coordinacion.util.js.map