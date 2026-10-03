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
export const MODULOS_CLINICA = [
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
] as const;
export type ModuloClinica = (typeof MODULOS_CLINICA)[number];

export const CANALES_AGENTE = ['whatsapp', 'instagram'] as const;
export type CanalAgente = (typeof CANALES_AGENTE)[number];

export const ACCIONES_AGENTE = ['schedule', 'reschedule', 'cancel'] as const;
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

function leer(accesos: unknown): AccesosClinica {
  return accesos && typeof accesos === 'object' ? (accesos as AccesosClinica) : {};
}

export function moduloHabilitado(accesos: unknown, modulo: string): boolean {
  return (leer(accesos).modules as Record<string, boolean | undefined> | undefined)?.[modulo] !== false;
}

/** Mapa completo módulo → habilitado, para el token y el frontend. */
export function modulosDeClinica(accesos: unknown): Record<ModuloClinica, boolean> {
  return Object.fromEntries(MODULOS_CLINICA.map((m) => [m, moduloHabilitado(accesos, m)])) as Record<
    ModuloClinica,
    boolean
  >;
}

export function agenteHabilitado(accesos: unknown, canal?: CanalAgente): boolean {
  const a = leer(accesos).agent;
  if (a?.enabled === false) return false;
  return !canal || a?.channels?.[canal] !== false;
}

export function accionDelAgenteHabilitada(accesos: unknown, accion: string): boolean {
  if (!agenteHabilitado(accesos)) return false;
  return (leer(accesos).agent?.actions as Record<string, boolean | undefined> | undefined)?.[accion] !== false;
}

export function recordatoriosHabilitados(accesos: unknown): boolean {
  return agenteHabilitado(accesos) && leer(accesos).agent?.reminders !== false;
}

/**
 * Los permisos de un rol, recortados a los módulos que la clínica tiene. Un
 * módulo bloqueado queda con todas sus acciones en false, venga lo que venga
 * en el rol.
 */
export function recortarPermisos(permisos: unknown, accesos: unknown): Record<string, unknown> {
  const base = permisos && typeof permisos === 'object' ? { ...(permisos as Record<string, unknown>) } : {};
  for (const modulo of MODULOS_CLINICA) {
    if (moduloHabilitado(accesos, modulo)) continue;
    const actual = base[modulo];
    base[modulo] =
      actual && typeof actual === 'object' && !Array.isArray(actual)
        ? Object.fromEntries(Object.keys(actual as object).map((k) => [k, false]))
        : { view: false };
  }
  return base;
}

/**
 * Módulo al que pertenece una ruta del gateway, si se puede atribuir a uno
 * solo. Las rutas compartidas (profesionales, tratamientos, configuración de
 * la clínica) las usan varios módulos y no se cortan aquí.
 */
export function moduloDeRuta(ruta: string): ModuloClinica | null {
  const r = ruta.split('?')[0];
  const reglas: [string, ModuloClinica][] = [
    ['/api/core/conversations', 'conversations'],
    ['/api/core/agenda', 'agenda'],
    ['/api/core/metrics', 'metrics'],
    ['/api/core/integrations', 'integrations'],
    ['/api/core/agent-config', 'agent_actions'],
    ['/api/agent/simulate', 'simulator'],
    ['/api/auth/users', 'users'],
  ];
  for (const [prefijo, modulo] of reglas) {
    if (r === prefijo || r.startsWith(prefijo + '/')) return modulo;
  }
  return null;
}
