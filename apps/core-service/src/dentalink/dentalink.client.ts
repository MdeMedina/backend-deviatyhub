/**
 * Cliente mínimo de la API de Dentalink (Healthatom), solo lectura.
 *
 * Referencia: https://api.dentalink.healthatom.com/docs/
 * - Cabecera "Authorization: Token <token>".
 * - Rutas bajo /api/v1 (no /v1).
 * - Filtros en `q` como JSON: {"fecha":[{"gte":"..."},{"lte":"..."}]}.
 * - Paginación por cursor: se sigue links.next hasta que no venga.
 * - Fechas y horas sin zona, en la hora local de la clínica.
 * - El límite de peticiones no está documentado (la cuenta informa "60,1"):
 *   se espera un poco entre página y página para no rozarlo.
 */

const BASE = 'https://api.dentalink.healthatom.com/api/v1';
const PAUSA_MS = 1100;
const MAX_PAGINAS = 200;

export class DentalinkError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export interface DlSucursal { id: number; nombre: string; habilitada?: number }
export interface DlDentista { id: number; nombre: string; apellidos?: string; rut?: string; habilitado?: number; id_especialidad?: number }
export interface DlCita {
  id: number;
  id_paciente?: number;
  nombre_paciente?: string;
  id_estado?: number;
  estado_cita?: string;
  estado_anulacion?: number | boolean;
  estado_confirmacion?: number | boolean;
  nombre_tratamiento?: string;
  motivo_atencion?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin?: string;
  duracion?: number;
  id_dentista?: number;
  nombre_dentista?: string;
  id_sucursal?: number;
}
export interface DlBloqueo { id: number; id_dentista?: number; id_sucursal?: number; fecha: string; hora_inicio: string; hora_fin: string }

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class DentalinkClient {
  constructor(private readonly token: string) {}

  private async pedir(url: string): Promise<any> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Token ${this.token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw new DentalinkError(`No se pudo conectar con Dentalink: ${(e as Error).message}`);
    }
    if (res.status === 429) {
      // Límite de peticiones: una sola espera larga y un reintento.
      await espera(10_000);
      return this.pedir(url);
    }
    if (!res.ok) {
      const cuerpo: any = await res.json().catch(() => ({}));
      const detalle = cuerpo?.error?.message || cuerpo?.message || '';
      if (res.status === 401) throw new DentalinkError('Dentalink rechazó el token (401).', 401);
      if (res.status === 403) throw new DentalinkError(`El token no tiene permiso para esta consulta (403). ${detalle}`.trim(), 403);
      throw new DentalinkError(`Dentalink respondió ${res.status}. ${detalle}`.trim(), res.status);
    }
    return res.json();
  }

  /** Todas las páginas de un listado. */
  private async listar<T>(ruta: string, q?: Record<string, unknown>, extra = ''): Promise<T[]> {
    const params = new URLSearchParams();
    if (q) params.set('q', JSON.stringify(q));
    let url: string | null = `${BASE}${ruta}${params.toString() ? `?${params}` : ''}${extra}`;
    const todo: T[] = [];
    for (let i = 0; url && i < MAX_PAGINAS; i++) {
      if (i > 0) await espera(PAUSA_MS);
      const cuerpo: any = await this.pedir(url);
      const datos = cuerpo?.data;
      if (Array.isArray(datos)) todo.push(...datos);
      else if (datos) todo.push(datos);
      url = cuerpo?.links?.next || null;
    }
    return todo;
  }

  sucursales() {
    return this.listar<DlSucursal>('/sucursales');
  }

  dentistas() {
    return this.listar<DlDentista>('/dentistas');
  }

  /** Zona horaria configurada en la cuenta (p. ej. "America/Santiago"), si la expone. */
  async zonaHoraria(): Promise<string | null> {
    try {
      const filas = await this.listar<any>('/configuraciones', { parametro: { eq: 'timezone' } });
      const v = filas[0]?.valor ?? filas[0]?.value ?? null;
      return typeof v === 'string' ? v : null;
    } catch {
      return null;
    }
  }

  /** Citas de una sucursal entre dos fechas (AAAA-MM-DD), incluidas las anuladas. */
  citas(idSucursal: number, desde: string, hasta: string) {
    return this.listar<DlCita>(`/sucursales/${idSucursal}/citas`, { fecha: [{ gte: desde }, { lte: hasta }] }, '&sort=fecha:asc');
  }

  /** Horarios bloqueados de una sucursal entre dos fechas. */
  bloqueos(idSucursal: number, desde: string, hasta: string) {
    return this.listar<DlBloqueo>('/horariosbloqueados', {
      id_sucursal: { eq: idSucursal },
      fecha: [{ gte: desde }, { lte: hasta }],
    });
  }
}
