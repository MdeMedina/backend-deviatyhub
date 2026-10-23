import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { ajustesDelAgente, decryptAES256, encryptAES256 } from '@deviaty/shared-utils';
import { DentalinkClient, DentalinkError, DlBloqueo, DlCita } from './dentalink.client';

/** Resumen de la última sincronización, guardado junto a la integración. */
export interface ResumenSync {
  at: string;
  ok: boolean;
  motivo: 'diaria' | 'periodica' | 'manual';
  desde?: string;
  hasta?: string;
  citas_leidas?: number;
  creadas?: number;
  actualizadas?: number;
  anuladas?: number;
  coordinadas?: number;
  pendientes?: number;
  no_encontradas?: number;
  bloqueos?: number;
  dentistas_sin_vincular?: { id: number; nombre: string; citas: number }[];
  aviso?: string | null;
  error?: string | null;
  duracion_ms?: number;
}

const CADA_MIN = 10;
/** Cuánto antes de la apertura se hace la coordinación diaria. */
const ANTES_DE_ABRIR_MIN = 60;
/** Durante el horario de atención, una pasada cada este tiempo. */
const PERIODICA_MIN = 120;

const dos = (n: number) => String(n).padStart(2, '0');
const isoDia = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const aMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
/** Fecha y hora de Dentalink (sin zona, hora local de la clínica) a Date. Los contenedores corren con TZ de la clínica. */
const fechaLocal = (fecha: string, hora: string) => {
  const [y, mo, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  return new Date(y, mo - 1, d, h || 0, mi || 0, 0, 0);
};
const verdadero = (v: unknown) => v === true || v === 1 || v === '1';

/**
 * Coordinación de agenda con Dentalink.
 *
 * Manda Dentalink. Antes de abrir cada día (y cada 2 horas mientras la clínica
 * atiende) se traen sus citas y bloqueos de los próximos días:
 * - Las citas de Dentalink entran como citas externas y ocupan esas horas, así
 *   el agente no las ofrece. Si allí se mueven o se anulan, aquí también.
 * - Lo que se agendó, movió o anuló desde Dentral queda "pendiente" hasta que
 *   el personal lo repite en Dentalink; al encontrarlo, la cita pasa a
 *   "coordinada". Si no aparece, NO se cancela: queda pendiente y se avisa.
 * - Los bloqueos de horario entran como ausencias del profesional.
 *
 * Solo lectura sobre Dentalink: nunca escribe allí.
 */
@Injectable()
export class DentalinkService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DentalinkService.name);
  private timer?: NodeJS.Timeout;
  private enCurso = new Set<string>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.DENTALINK_SYNC_DISABLED === 'true') return;
    this.timer = setInterval(() => this.revisarProgramadas().catch((e) => this.logger.error(e)), CADA_MIN * 60_000);
    setTimeout(() => this.revisarProgramadas().catch((e) => this.logger.error(e)), 30_000);
    this.logger.log(`Coordinación con Dentalink: revisión cada ${CADA_MIN} min.`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ─── Credenciales ───────────────────────────────────────────────────

  private get clave(): string {
    const s = process.env.JWT_ACCESS_SECRET;
    if (!s) throw new Error('JWT_ACCESS_SECRET no está configurado');
    return s;
  }

  private async integracion(clinicId: string) {
    return this.prisma.clinicIntegration.findUnique({ where: { clinicId_type: { clinicId, type: 'DENTALINK' } } });
  }

  private token(cred: any): string | null {
    if (!cred?.encrypted_data) return null;
    try {
      return JSON.parse(decryptAES256(cred.encrypted_data, this.clave)).access_token || null;
    } catch (e) {
      this.logger.error(`No se pudo descifrar el token de Dentalink: ${(e as Error).message}`);
      return null;
    }
  }

  private async guardarCred(clinicId: string, cambios: Record<string, unknown>, extra: { connected?: boolean } = {}) {
    const actual = await this.integracion(clinicId);
    const credentials = { ...((actual?.credentials as any) || {}), ...cambios };
    await this.prisma.clinicIntegration.upsert({
      where: { clinicId_type: { clinicId, type: 'DENTALINK' } },
      create: { clinicId, type: 'DENTALINK', credentials, connected: extra.connected ?? false },
      update: { credentials, ...(extra.connected !== undefined ? { connected: extra.connected } : {}) },
    });
  }

  private async exigirClinica(clinicId: string) {
    const c = await this.prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true } });
    if (!c) throw new NotFoundException('Clínica no encontrada');
  }

  // ─── Backoffice: estado, conexión y vínculo de profesionales ─────────

  async estado(clinicId: string) {
    await this.exigirClinica(clinicId);
    const integ = await this.integracion(clinicId);
    const cred = (integ?.credentials as any) || {};
    const [doctores, pendientes] = await Promise.all([
      this.prisma.doctor.findMany({
        where: { clinicId, active: true },
        select: { id: true, name: true, title: true, externalId: true, bookingMode: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.appointment.count({ where: { clinicId, coordination: 'pendiente' } }),
    ]);
    return {
      connected: integ?.connected === true,
      has_token: Boolean(cred.encrypted_data),
      sucursal: cred.id_sucursal ? { id: cred.id_sucursal, nombre: cred.nombre_sucursal ?? null } : null,
      timezone: cred.timezone ?? null,
      last_sync: (cred.last_sync as ResumenSync) ?? null,
      last_error: cred.last_error ?? null,
      pending_coordination: pendientes,
      doctors: doctores.map((d) => ({
        id: d.id,
        name: `${d.title ? `${d.title} ` : ''}${d.name}`.trim(),
        booking_mode: d.bookingMode,
        external_id: d.externalId,
      })),
    };
  }

  /**
   * Guarda el token (cifrado) y la sucursal. Sin sucursal, devuelve las que
   * ve el token para elegir. Comprueba el token antes de guardarlo.
   */
  async configurar(clinicId: string, dto: { token?: string; id_sucursal?: number }) {
    await this.exigirClinica(clinicId);
    const integ = await this.integracion(clinicId);
    const cred = (integ?.credentials as any) || {};
    const token = dto.token?.trim() || this.token(cred);
    if (!token) throw new BadRequestException('Falta el token de Dentalink.');

    const cliente = new DentalinkClient(token);
    let sucursales;
    try {
      sucursales = await cliente.sucursales();
    } catch (e) {
      const msg = e instanceof DentalinkError ? e.message : (e as Error).message;
      await this.guardarCred(clinicId, { last_error: msg }, { connected: false });
      throw new BadRequestException(msg);
    }

    const cambios: Record<string, unknown> = { last_error: null };
    if (dto.token?.trim()) cambios.encrypted_data = encryptAES256(JSON.stringify({ access_token: token }), this.clave);

    const elegida = dto.id_sucursal ? sucursales.find((s) => Number(s.id) === Number(dto.id_sucursal)) : sucursales.length === 1 ? sucursales[0] : null;
    if (dto.id_sucursal && !elegida) throw new BadRequestException('Esa sucursal no está en la cuenta de Dentalink.');
    if (elegida) {
      cambios.id_sucursal = Number(elegida.id);
      cambios.nombre_sucursal = elegida.nombre;
      const tz = await cliente.zonaHoraria();
      cambios.timezone = tz;
    }

    await this.guardarCred(clinicId, cambios, { connected: Boolean(elegida || cred.id_sucursal) });
    await this.prisma.clinicIntegration.update({
      where: { clinicId_type: { clinicId, type: 'DENTALINK' } },
      data: { lastTestedAt: new Date(), lastTestOk: true },
    });

    return {
      sucursales: sucursales.map((s) => ({ id: s.id, nombre: s.nombre, habilitada: s.habilitada !== 0 })),
      ...(await this.estado(clinicId)),
    };
  }

  /** Profesionales de Dentalink, para vincularlos con los de Dentral. */
  async dentistas(clinicId: string) {
    const cred = ((await this.integracion(clinicId))?.credentials as any) || {};
    const token = this.token(cred);
    if (!token) throw new BadRequestException('Dentalink no está conectado.');
    try {
      const lista = await new DentalinkClient(token).dentistas();
      return lista
        .map((d) => ({ id: Number(d.id), nombre: `${d.nombre ?? ''} ${d.apellidos ?? ''}`.trim(), habilitado: d.habilitado !== 0 }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (e) {
      throw new BadRequestException(e instanceof DentalinkError ? e.message : (e as Error).message);
    }
  }

  async vincular(clinicId: string, vinculos: { doctor_id: string; external_id: string | number | null }[]) {
    await this.exigirClinica(clinicId);
    const ids = vinculos.map((v) => String(v.external_id ?? '')).filter(Boolean);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Un profesional de Dentalink no puede ir con dos de Dentral.');
    await this.prisma.$transaction(
      vinculos.map((v) =>
        this.prisma.doctor.updateMany({
          where: { id: v.doctor_id, clinicId },
          data: { externalId: v.external_id == null || v.external_id === '' ? null : String(v.external_id) },
        }),
      ),
    );
    return this.estado(clinicId);
  }

  async desconectar(clinicId: string) {
    await this.exigirClinica(clinicId);
    await this.prisma.clinicIntegration.deleteMany({ where: { clinicId, type: 'DENTALINK' } });
    // Lo que estaba por coordinar ya no aplica: no hay agenda oficial con la que coordinar.
    await this.prisma.appointment.updateMany({
      where: { clinicId, coordination: 'pendiente' },
      data: { coordination: null, coordinationAction: null },
    });
    return this.estado(clinicId);
  }

  // ─── Programación ───────────────────────────────────────────────────

  /** ¿Toca sincronizar alguna clínica ahora? Diaria antes de abrir, y cada 2 h en horario. */
  async revisarProgramadas(ahora = new Date()) {
    const integraciones = await this.prisma.clinicIntegration.findMany({
      where: { type: 'DENTALINK', connected: true },
      select: { clinicId: true, credentials: true },
    });
    for (const integ of integraciones) {
      const cred = (integ.credentials as any) || {};
      const ultima = cred.last_sync?.at ? new Date(cred.last_sync.at) : null;
      const motivo = await this.motivoProgramado(integ.clinicId, ahora, ultima);
      if (!motivo) continue;
      await this.sincronizar(integ.clinicId, motivo).catch((e) => this.logger.error(`Sync Dentalink ${integ.clinicId}: ${(e as Error).message}`));
    }
  }

  private async motivoProgramado(clinicId: string, ahora: Date, ultima: Date | null): Promise<ResumenSync['motivo'] | null> {
    const horario = await this.prisma.clinicSchedule.findFirst({ where: { clinicId, dayOfWeek: ahora.getDay() } });
    const abre = horario?.isOpen !== false && horario ? aMin(horario.openTime) : null;
    const cierra = horario?.isOpen !== false && horario ? aMin(horario.closeTime) : null;
    const minutoAhora = ahora.getHours() * 60 + ahora.getMinutes();

    // Diaria: la primera del día, desde una hora antes de abrir. Un día que
    // no abre se hace igual a las 8:00, para tener al día los siguientes.
    const desdeDiaria = abre != null ? abre - ANTES_DE_ABRIR_MIN : 8 * 60;
    const hechaHoy = ultima && isoDia(ultima) === isoDia(ahora);
    if (!hechaHoy && minutoAhora >= desdeDiaria) return 'diaria';

    // Periódica: en horario de atención, si la última fue hace más de 2 h.
    if (abre != null && cierra != null && minutoAhora >= abre && minutoAhora < cierra) {
      if (!ultima || ahora.getTime() - ultima.getTime() >= PERIODICA_MIN * 60_000) return 'periodica';
    }
    return null;
  }

  // ─── Sincronización ─────────────────────────────────────────────────

  async sincronizar(clinicId: string, motivo: ResumenSync['motivo'] = 'manual'): Promise<ResumenSync> {
    if (this.enCurso.has(clinicId)) throw new BadRequestException('Ya hay una sincronización en curso para esta clínica.');
    this.enCurso.add(clinicId);
    const inicio = Date.now();
    const resumen: ResumenSync = { at: new Date().toISOString(), ok: false, motivo };
    try {
      await this.ejecutar(clinicId, resumen);
      resumen.ok = true;
      resumen.error = null;
    } catch (e) {
      resumen.error = e instanceof DentalinkError || e instanceof BadRequestException ? (e as Error).message : `Error interno: ${(e as Error).message}`;
      this.logger.error(`Sync Dentalink ${clinicId} falló: ${resumen.error}`);
    } finally {
      resumen.duracion_ms = Date.now() - inicio;
      this.enCurso.delete(clinicId);
      await this.guardarCred(clinicId, { last_sync: resumen, last_error: resumen.error ?? null }).catch(() => undefined);
    }
    this.logger.log(
      `Sync Dentalink ${clinicId} (${motivo}): ${resumen.ok ? 'ok' : 'error'} · leídas ${resumen.citas_leidas ?? 0}, nuevas ${resumen.creadas ?? 0}, ` +
        `actualizadas ${resumen.actualizadas ?? 0}, anuladas ${resumen.anuladas ?? 0}, coordinadas ${resumen.coordinadas ?? 0}, pendientes ${resumen.pendientes ?? 0}`,
    );
    return resumen;
  }

  private async ejecutar(clinicId: string, r: ResumenSync) {
    const integ = await this.integracion(clinicId);
    const cred = (integ?.credentials as any) || {};
    const token = this.token(cred);
    if (!integ?.connected || !token) throw new BadRequestException('Dentalink no está conectado.');
    if (!cred.id_sucursal) throw new BadRequestException('Falta elegir la sucursal de Dentalink.');

    const doctores = await this.prisma.doctor.findMany({ where: { clinicId, externalId: { not: null } }, select: { id: true, externalId: true } });
    if (!doctores.length) throw new BadRequestException('No hay profesionales vinculados con Dentalink.');
    const doctorDe = new Map(doctores.map((d) => [String(d.externalId), d.id]));

    // Rango: de hoy hasta el máximo de anticipación de la clínica (entre 14 y 60 días).
    const config = await this.prisma.agentConfig.findFirst({ where: { clinicId }, select: { settings: true } });
    const ajustes = ajustesDelAgente((config as any)?.settings);
    const dias = Math.min(60, Math.max(14, ajustes.anticipacionMaxDias ?? 30));
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(hoy);
    fin.setDate(fin.getDate() + dias);
    fin.setHours(23, 59, 59, 999);
    r.desde = isoDia(hoy);
    r.hasta = isoDia(fin);

    if (cred.timezone && process.env.TZ && cred.timezone !== process.env.TZ) {
      r.aviso = `Dentalink usa la zona ${cred.timezone} y el servidor ${process.env.TZ}: las horas pueden quedar corridas.`;
    }

    const cliente = new DentalinkClient(token);
    const citas = await cliente.citas(Number(cred.id_sucursal), r.desde, r.hasta);
    let bloqueos: DlBloqueo[] = [];
    try {
      bloqueos = await cliente.bloqueos(Number(cred.id_sucursal), r.desde, r.hasta);
    } catch (e) {
      // Un token sin permiso para bloqueos no debe impedir traer las citas.
      r.aviso = [r.aviso, `No se pudieron leer los bloqueos: ${(e as Error).message}`].filter(Boolean).join(' ');
    }

    await this.aplicarCitas(clinicId, citas, doctorDe, hoy, fin, r);
    r.bloqueos = await this.aplicarBloqueos(clinicId, bloqueos, doctorDe, hoy, fin);

    r.pendientes = await this.prisma.appointment.count({ where: { clinicId, coordination: 'pendiente' } });
  }

  private async aplicarCitas(clinicId: string, citas: DlCita[], doctorDe: Map<string, string>, desde: Date, hasta: Date, r: ResumenSync) {
    r.citas_leidas = citas.length;
    r.creadas = r.actualizadas = r.anuladas = r.coordinadas = r.no_encontradas = 0;

    const sinVincular = new Map<number, { id: number; nombre: string; citas: number }>();
    const nuestras = citas.filter((c) => {
      if (c.id_dentista != null && doctorDe.has(String(c.id_dentista))) return true;
      if (c.id_dentista != null && !verdadero(c.estado_anulacion)) {
        const s = sinVincular.get(c.id_dentista) ?? { id: c.id_dentista, nombre: c.nombre_dentista ?? '', citas: 0 };
        s.citas++;
        sinVincular.set(c.id_dentista, s);
      }
      return false;
    });
    r.dentistas_sin_vincular = [...sinVincular.values()];

    const idsExternos = nuestras.map((c) => String(c.id));
    const locales = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        OR: [{ externalId: { in: idsExternos } }, { scheduledAt: { gte: desde, lte: hasta } }],
      },
    });
    const porExterno = new Map(locales.filter((a) => a.externalId).map((a) => [a.externalId as string, a]));
    const porCrear = locales.filter(
      (a) => !a.externalId && a.coordination === 'pendiente' && a.coordinationAction === 'crear' && a.status !== 'CANCELLED',
    );
    const vistos = new Set<string>();
    const ahora = new Date();

    for (const c of nuestras) {
      const idExt = String(c.id);
      vistos.add(idExt);
      const doctorId = doctorDe.get(String(c.id_dentista))!;
      const inicio = fechaLocal(c.fecha, c.hora_inicio);
      const duracion = Number(c.duracion) || (c.hora_fin ? Math.max(5, aMin(c.hora_fin) - aMin(c.hora_inicio)) : 30);
      const anulada = verdadero(c.estado_anulacion);
      const atendida = /atendid/i.test(c.estado_cita ?? '');
      const confirmada = verdadero(c.estado_confirmacion);
      const local = porExterno.get(idExt);

      if (local) {
        if (local.coordination === 'pendiente') {
          // Cambio hecho en Dentral que el personal aún no repetía en Dentalink:
          // no se pisa. Se da por coordinado cuando Dentalink ya lo refleja.
          const hecho =
            (local.coordinationAction === 'anular' && anulada) ||
            (local.coordinationAction === 'mover' && !anulada && local.doctorId === doctorId && Math.abs(local.scheduledAt.getTime() - inicio.getTime()) < 5 * 60_000) ||
            local.coordinationAction === 'crear';
          if (hecho) {
            await this.prisma.appointment.update({
              where: { id: local.id },
              data: { coordination: 'coordinada', coordinationAction: null, coordinatedAt: ahora, coordinatedBy: 'dentalink' },
            });
            r.coordinadas!++;
          }
          continue;
        }

        const status = anulada ? 'CANCELLED' : atendida ? 'COMPLETED' : local.source === 'EXTERNAL' ? (confirmada ? 'CONFIRMED' : 'PENDING') : local.status === 'CANCELLED' ? 'CONFIRMED' : local.status;
        const movida = local.scheduledAt.getTime() !== inicio.getTime();
        const cambios: Record<string, unknown> = {};
        if (movida) cambios.scheduledAt = inicio;
        if (local.durationMin !== duracion) cambios.durationMin = duracion;
        if (local.doctorId !== doctorId) cambios.doctorId = doctorId;
        if (local.status !== status) cambios.status = status;
        if (local.source === 'EXTERNAL' && c.nombre_paciente && local.contactName !== c.nombre_paciente) cambios.contactName = c.nombre_paciente;
        if (movida) Object.assign(cambios, { reminder3dSent: false, reminder1dSent: false, reminder1hSent: false });
        if (Object.keys(cambios).length) {
          await this.prisma.$transaction([
            this.prisma.appointment.update({ where: { id: local.id }, data: cambios }),
            this.prisma.appointmentHistory.create({
              data: { appointmentId: local.id, event: 'synced_from_dentalink', payload: { by: 'dentalink', changes: Object.keys(cambios) } },
            }),
          ]);
          if (status === 'CANCELLED' && local.status !== 'CANCELLED') r.anuladas!++;
          else r.actualizadas!++;
        }
        continue;
      }

      if (anulada) continue;

      // ¿Es una cita agendada desde Dentral que el personal ya pasó? Mismo profesional y hora.
      const i = porCrear.findIndex((a) => a.doctorId === doctorId && Math.abs(a.scheduledAt.getTime() - inicio.getTime()) < 5 * 60_000);
      if (i >= 0) {
        const a = porCrear.splice(i, 1)[0];
        await this.prisma.$transaction([
          this.prisma.appointment.update({
            where: { id: a.id },
            data: { externalId: idExt, coordination: 'coordinada', coordinationAction: null, coordinatedAt: ahora, coordinatedBy: 'dentalink' },
          }),
          this.prisma.appointmentHistory.create({
            data: { appointmentId: a.id, event: 'coordinated_dentalink', payload: { by: 'dentalink', external_id: idExt } },
          }),
        ]);
        r.coordinadas!++;
        continue;
      }

      await this.prisma.appointment.create({
        data: {
          clinicId,
          doctorId,
          scheduledAt: inicio,
          durationMin: duracion,
          status: atendida ? 'COMPLETED' : confirmada ? 'CONFIRMED' : 'PENDING',
          source: 'EXTERNAL',
          externalId: idExt,
          contactName: c.nombre_paciente ?? null,
          notes: [c.nombre_tratamiento, c.motivo_atencion].filter(Boolean).join(' · ') || null,
          // Sin teléfono del paciente no hay recordatorio que mandar.
          reminder3dSent: true,
          reminder1dSent: true,
          reminder1hSent: true,
        },
      });
      r.creadas!++;
    }

    // Lo que trajimos antes y ya no está en Dentalink (dentro del rango leído).
    for (const a of locales) {
      if (!a.externalId || vistos.has(a.externalId) || a.status === 'CANCELLED') continue;
      if (a.scheduledAt < desde || a.scheduledAt > hasta) continue;
      if (!a.doctorId || ![...doctorDe.values()].includes(a.doctorId)) continue;
      if (a.coordination === 'pendiente') continue;

      if (a.source === 'EXTERNAL') {
        await this.prisma.$transaction([
          this.prisma.appointment.update({ where: { id: a.id }, data: { status: 'CANCELLED' } }),
          this.prisma.appointmentHistory.create({
            data: { appointmentId: a.id, event: 'synced_from_dentalink', payload: { by: 'dentalink', removed: true } },
          }),
        ]);
        r.anuladas!++;
      } else {
        // Cita del chat que desapareció de Dentalink: no se cancela al paciente, se avisa.
        await this.prisma.appointment.update({
          where: { id: a.id },
          data: { externalId: null, coordination: 'pendiente', coordinationAction: 'crear', coordinatedAt: null, coordinatedBy: null },
        });
        r.no_encontradas!++;
      }
    }

    // Agendadas desde Dentral, ya en el rango, que el personal no ha pasado.
    r.no_encontradas! += porCrear.filter((a) => a.scheduledAt >= new Date()).length;
  }

  private async aplicarBloqueos(clinicId: string, bloqueos: DlBloqueo[], doctorDe: Map<string, string>, desde: Date, hasta: Date) {
    const deseados = new Map<string, { doctorId: string; startsAt: Date; endsAt: Date }>();
    for (const b of bloqueos) {
      const doctores = b.id_dentista ? [doctorDe.get(String(b.id_dentista))].filter(Boolean) as string[] : [...doctorDe.values()];
      for (const doctorId of doctores) {
        deseados.set(`dentalink:${b.id}:${doctorId}`, {
          doctorId,
          startsAt: fechaLocal(b.fecha, b.hora_inicio),
          endsAt: fechaLocal(b.fecha, b.hora_fin),
        });
      }
    }

    const actuales = await this.prisma.doctorAbsence.findMany({
      where: { clinicId, externalId: { startsWith: 'dentalink:' }, startsAt: { lte: hasta }, endsAt: { gte: desde } },
    });
    const porId = new Map(actuales.map((a) => [a.externalId as string, a]));

    for (const [externalId, b] of deseados) {
      const a = porId.get(externalId);
      if (!a) {
        await this.prisma.doctorAbsence.create({
          data: { clinicId, doctorId: b.doctorId, startsAt: b.startsAt, endsAt: b.endsAt, allDay: false, reason: 'Bloqueo en Dentalink', externalId },
        });
      } else if (a.startsAt.getTime() !== b.startsAt.getTime() || a.endsAt.getTime() !== b.endsAt.getTime() || a.doctorId !== b.doctorId) {
        await this.prisma.doctorAbsence.update({ where: { id: a.id }, data: { startsAt: b.startsAt, endsAt: b.endsAt, doctorId: b.doctorId } });
      }
    }
    const sobran = actuales.filter((a) => !deseados.has(a.externalId as string)).map((a) => a.id);
    if (sobran.length) await this.prisma.doctorAbsence.deleteMany({ where: { id: { in: sobran } } });
    return deseados.size;
  }

  // ─── Panel de la clínica: lo que falta pasar a Dentalink ─────────────

  async porCoordinar(clinicId: string) {
    const integ = await this.integracion(clinicId);
    const cred = (integ?.credentials as any) || {};
    const citas = await this.prisma.appointment.findMany({
      where: { clinicId, coordination: 'pendiente' },
      orderBy: { scheduledAt: 'asc' },
      include: {
        doctor: { select: { name: true, title: true } },
        treatment: { select: { name: true } },
        contact: { select: { name: true, lastName: true, phone: true, rut: true } },
      },
    });
    return {
      enabled: integ?.connected === true,
      last_sync: (cred.last_sync as ResumenSync) ?? null,
      items: citas.map((a) => ({
        id: a.id,
        code: a.code,
        action: a.coordinationAction ?? 'crear',
        status: a.status,
        scheduled_at: a.scheduledAt,
        duration_min: a.durationMin,
        source: a.source,
        doctor: a.doctor ? `${a.doctor.title ? `${a.doctor.title} ` : ''}${a.doctor.name}`.trim() : null,
        treatment: a.treatment?.name ?? null,
        patient: a.contact ? `${a.contact.name ?? ''} ${a.contact.lastName ?? ''}`.trim() || a.contactName : a.contactName,
        phone: (a.contact as any)?.phone ?? null,
        rut: (a.contact as any)?.rut ?? null,
        conversation_id: a.conversationId,
        updated_at: a.updatedAt,
      })),
    };
  }

  /** El personal avisa que ya lo hizo en Dentalink. La próxima sincronización lo verifica. */
  async marcarCoordinada(clinicId: string, appointmentId: string, quien: string) {
    const cita = await this.prisma.appointment.findFirst({ where: { id: appointmentId, clinicId } });
    if (!cita) throw new NotFoundException('Cita no encontrada');
    if (cita.coordination !== 'pendiente') return { ok: true };
    await this.prisma.$transaction([
      this.prisma.appointment.update({
        where: { id: cita.id },
        data: { coordination: 'coordinada', coordinationAction: null, coordinatedAt: new Date(), coordinatedBy: quien },
      }),
      this.prisma.appointmentHistory.create({
        data: { appointmentId: cita.id, event: 'coordinated_dentalink', payload: { by: quien, action: cita.coordinationAction } },
      }),
    ]);
    return { ok: true };
  }
}
