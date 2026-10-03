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
/** Secciones del panel de la clínica. Coinciden con los módulos de los permisos de rol. */
export declare const MODULOS_CLINICA: readonly ["conversations", "agenda", "knowledge_base", "agent_actions", "simulator", "metrics", "integrations", "clinic_config", "users", "security"];
export type ModuloClinica = (typeof MODULOS_CLINICA)[number];
export declare const CANALES_AGENTE: readonly ["whatsapp", "instagram"];
export type CanalAgente = (typeof CANALES_AGENTE)[number];
export declare const ACCIONES_AGENTE: readonly ["schedule", "reschedule", "cancel"];
export type AccionAgente = (typeof ACCIONES_AGENTE)[number];
export interface AccesosClinica {
    modules?: Partial<Record<ModuloClinica, boolean>>;
    agent?: {
        /** El agente entero. Apagado, no responde por ningún canal. */
        enabled?: boolean;
        channels?: Partial<Record<CanalAgente, boolean>>;
        actions?: Partial<Record<AccionAgente, boolean>>;
        /** Recordatorios de 3 días, 1 día y 2 horas. */
        reminders?: boolean;
    };
}
export declare function moduloHabilitado(accesos: unknown, modulo: string): boolean;
/** Mapa completo módulo → habilitado, para el token y el frontend. */
export declare function modulosDeClinica(accesos: unknown): Record<ModuloClinica, boolean>;
export declare function agenteHabilitado(accesos: unknown, canal?: CanalAgente): boolean;
export declare function accionDelAgenteHabilitada(accesos: unknown, accion: string): boolean;
export declare function recordatoriosHabilitados(accesos: unknown): boolean;
/**
 * Los permisos de un rol, recortados a los módulos que la clínica tiene. Un
 * módulo bloqueado queda con todas sus acciones en false, venga lo que venga
 * en el rol.
 */
export declare function recortarPermisos(permisos: unknown, accesos: unknown): Record<string, unknown>;
/**
 * Módulo al que pertenece una ruta del gateway, si se puede atribuir a uno
 * solo. Las rutas compartidas (profesionales, tratamientos, configuración de
 * la clínica) las usan varios módulos y no se cortan aquí.
 */
export declare function moduloDeRuta(ruta: string): ModuloClinica | null;
//# sourceMappingURL=accesos.util.d.ts.map