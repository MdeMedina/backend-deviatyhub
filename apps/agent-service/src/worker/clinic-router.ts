import { decryptAES256 } from '@deviaty/shared-utils';

/**
 * A qué clínica pertenece un mensaje entrante de WhatsApp.
 *
 * Todas las clínicas reciben por el mismo webhook (una sola app de Meta), y lo
 * único que distingue a cuál le escribió el paciente es el número de destino:
 * `value.metadata.phone_number_id` en el payload. Hasta ahora se tomaba la
 * primera clínica de la tabla, así que con una segunda clínica sus pacientes
 * habrían caído en la agenda de la otra.
 *
 * El número de cada clínica está en sus credenciales de WhatsApp, que van
 * cifradas y no se pueden filtrar en SQL. Por eso se guarda además, en claro,
 * en `clinic_integrations.external_id` (un phone_number_id no es secreto: va en
 * cada payload de Meta). Las integraciones guardadas antes de esa columna se
 * resuelven descifrando y se completan al vuelo la primera vez.
 *
 * El número global del .env (WHATSAPP_PHONE_NUMBER_ID) es con el que salen las
 * respuestas de una clínica sin credenciales propias. Sus mensajes van a
 * WHATSAPP_DEFAULT_CLINIC_ID o, si no está definida, a la clínica más antigua:
 * es el comportamiento de antes para la clínica que ya está en producción.
 *
 * Un número que no es de ninguna clínica no se asigna a nadie: es preferible
 * perder un mensaje con un error en el log que meter a un paciente en la
 * agenda de otra clínica.
 */

export type ResultadoEnrutado =
  | { clinicId: string; via: 'external_id' | 'credenciales' | 'numero_global' }
  | { clinicId: null; motivo: string };

type PrismaEnrutado = {
  clinicIntegration: {
    findUnique(args: any): Promise<{ clinicId: string; type: string } | null>;
    findMany(args: any): Promise<Array<{ id: string; clinicId: string; credentials: unknown }>>;
    update(args: any): Promise<unknown>;
  };
  clinic: {
    findUnique(args: any): Promise<{ id: string } | null>;
    findFirst(args: any): Promise<{ id: string } | null>;
  };
};

type Opciones = {
  /** Clave con la que se cifran las credenciales (JWT_ACCESS_SECRET). */
  secreto?: string;
  /** WHATSAPP_PHONE_NUMBER_ID del .env. */
  numeroGlobal?: string;
  /** WHATSAPP_DEFAULT_CLINIC_ID del .env. */
  clinicaPorDefecto?: string;
  /** Cuánto se recuerda una resolución. Un número cambia de clínica muy rara vez. */
  ttlMs?: number;
  avisar?: (mensaje: string) => void;
};

export class EnrutadorDeClinica {
  private readonly cache = new Map<string, { resultado: ResultadoEnrutado; hasta: number }>();

  constructor(
    private readonly prisma: PrismaEnrutado,
    private readonly opciones: Opciones,
  ) {}

  async clinicaDe(phoneNumberId: string | undefined | null): Promise<ResultadoEnrutado> {
    const id = String(phoneNumberId || '').trim();
    if (!id) return { clinicId: null, motivo: 'el webhook no trae metadata.phone_number_id' };

    const ahora = Date.now();
    const guardado = this.cache.get(id);
    if (guardado && guardado.hasta > ahora) return guardado.resultado;

    const resultado = await this.resolver(id);
    // Lo que no se resolvió no se recuerda: así, en cuanto una clínica guarda su
    // número en el panel, el siguiente mensaje ya le llega.
    if (resultado.clinicId) this.cache.set(id, { resultado, hasta: ahora + (this.opciones.ttlMs ?? 60_000) });
    return resultado;
  }

  private async resolver(id: string): Promise<ResultadoEnrutado> {
    // 1. Lo normal: el número ya está registrado en claro.
    const directa = await this.prisma.clinicIntegration.findUnique({
      where: { externalId: id },
      select: { clinicId: true, type: true },
    });
    if (directa && directa.type === 'WHATSAPP') return { clinicId: directa.clinicId, via: 'external_id' };

    // 2. Integraciones anteriores a external_id: hay que descifrar para mirar.
    const porCredenciales = await this.buscarEnCredenciales(id);
    if (porCredenciales) return { clinicId: porCredenciales, via: 'credenciales' };

    // 3. El número global del .env.
    if (this.opciones.numeroGlobal && id === this.opciones.numeroGlobal.trim()) {
      const clinica = this.opciones.clinicaPorDefecto
        ? await this.prisma.clinic.findUnique({ where: { id: this.opciones.clinicaPorDefecto }, select: { id: true } })
        : await this.prisma.clinic.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
      if (clinica) return { clinicId: clinica.id, via: 'numero_global' };
      return {
        clinicId: null,
        motivo: this.opciones.clinicaPorDefecto
          ? `WHATSAPP_DEFAULT_CLINIC_ID (${this.opciones.clinicaPorDefecto}) no corresponde a ninguna clínica`
          : 'no hay ninguna clínica creada',
      };
    }

    return { clinicId: null, motivo: `el número ${id} no está conectado a ninguna clínica` };
  }

  private async buscarEnCredenciales(id: string): Promise<string | null> {
    if (!this.opciones.secreto) return null;
    const pendientes = await this.prisma.clinicIntegration.findMany({
      where: { type: 'WHATSAPP', externalId: null },
      select: { id: true, clinicId: true, credentials: true },
    });

    for (const integracion of pendientes) {
      const cifrado = (integracion.credentials as any)?.encrypted_data;
      if (!cifrado) continue;
      let numero = '';
      try {
        numero = String(JSON.parse(decryptAES256(cifrado, this.opciones.secreto))?.phone_number_id || '').trim();
      } catch {
        continue; // credenciales ilegibles: no son de este número, se sigue buscando
      }
      if (numero !== id) continue;

      // Se completa la columna para que la próxima vez sea una búsqueda directa.
      // Si falla (otra integración ya tiene ese número), se enruta igual.
      await this.prisma.clinicIntegration
        .update({ where: { id: integracion.id }, data: { externalId: id } })
        .catch((e: Error) =>
          this.opciones.avisar?.(`No se pudo registrar external_id ${id} en la integración ${integracion.id}: ${e.message}`),
        );
      return integracion.clinicId;
    }
    return null;
  }
}

/** Número de destino de un payload de la WhatsApp Cloud API. */
export function numeroDeDestino(payload: any): string | undefined {
  return payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
}
