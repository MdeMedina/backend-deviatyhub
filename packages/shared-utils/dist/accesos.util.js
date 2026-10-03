"use strict";
/**
 * Accesos de una clínica: lo que el equipo de la plataforma le habilita desde
 * el backoffice. Se guarda en clinics.entitlements y la clínica no lo puede
 * cambiar: sus propios ajustes (roles, acciones del agente, modo) solo actúan
 * dentro de lo que esto permite.
 *
 * Lo que no aparece está permitido. Así las clínicas que ya funcionaban, con
 * entitlements vacío, siguen exactamente igual, y bloquear algo es siempre una
 * decisión explícita.
 *
 * La entrada a la plataforma no está aquí: es clinics.active.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCIONES_AGENTE = exports.CANALES_AGENTE = exports.MODULOS_CLINICA = void 0;
exports.moduloHabilitado = moduloHabilitado;
exports.modulosDeClinica = modulosDeClinica;
exports.agenteHabilitado = agenteHabilitado;
exports.accionDelAgenteHabilitada = accionDelAgenteHabilitada;
exports.recordatoriosHabilitados = recordatoriosHabilitados;
exports.recortarPermisos = recortarPermisos;
exports.moduloDeRuta = moduloDeRuta;
/** Secciones del panel de la clínica. Coinciden con los módulos de los permisos de rol. */
exports.MODULOS_CLINICA = [
    'conversations',
    'agenda',
    'knowledge_base',
    'agent_actions',
    'simulator',
    'metrics',
    'integrations',
    'clinic_config',
    'users',
    'security',
];
exports.CANALES_AGENTE = ['whatsapp', 'instagram'];
exports.ACCIONES_AGENTE = ['schedule', 'reschedule', 'cancel'];
function leer(accesos) {
    return accesos && typeof accesos === 'object' ? accesos : {};
}
function moduloHabilitado(accesos, modulo) {
    return leer(accesos).modules?.[modulo] !== false;
}
/** Mapa completo módulo → habilitado, para el token y el frontend. */
function modulosDeClinica(accesos) {
    return Object.fromEntries(exports.MODULOS_CLINICA.map((m) => [m, moduloHabilitado(accesos, m)]));
}
function agenteHabilitado(accesos, canal) {
    const a = leer(accesos).agent;
    if (a?.enabled === false)
        return false;
    return !canal || a?.channels?.[canal] !== false;
}
function accionDelAgenteHabilitada(accesos, accion) {
    if (!agenteHabilitado(accesos))
        return false;
    return leer(accesos).agent?.actions?.[accion] !== false;
}
function recordatoriosHabilitados(accesos) {
    return agenteHabilitado(accesos) && leer(accesos).agent?.reminders !== false;
}
/**
 * Los permisos de un rol, recortados a los módulos que la clínica tiene. Un
 * módulo bloqueado queda con todas sus acciones en false, venga lo que venga
 * en el rol.
 */
function recortarPermisos(permisos, accesos) {
    const base = permisos && typeof permisos === 'object' ? { ...permisos } : {};
    for (const modulo of exports.MODULOS_CLINICA) {
        if (moduloHabilitado(accesos, modulo))
            continue;
        const actual = base[modulo];
        base[modulo] =
            actual && typeof actual === 'object' && !Array.isArray(actual)
                ? Object.fromEntries(Object.keys(actual).map((k) => [k, false]))
                : { view: false };
    }
    return base;
}
/**
 * Módulo al que pertenece una ruta del gateway, si se puede atribuir a uno
 * solo. Las rutas compartidas (profesionales, tratamientos, configuración de
 * la clínica) las usan varios módulos y no se cortan aquí.
 */
function moduloDeRuta(ruta) {
    const r = ruta.split('?')[0];
    const reglas = [
        ['/api/core/conversations', 'conversations'],
        ['/api/core/agenda', 'agenda'],
        ['/api/core/metrics', 'metrics'],
        ['/api/core/integrations', 'integrations'],
        ['/api/core/agent-config', 'agent_actions'],
        ['/api/agent/simulate', 'simulator'],
        ['/api/auth/users', 'users'],
    ];
    for (const [prefijo, modulo] of reglas) {
        if (r === prefijo || r.startsWith(prefijo + '/'))
            return modulo;
    }
    return null;
}
//# sourceMappingURL=accesos.util.js.map