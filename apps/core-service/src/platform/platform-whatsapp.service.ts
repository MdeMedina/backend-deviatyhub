import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { decryptAES256, encryptAES256 } from '@deviaty/shared-utils';

const GRAPH = 'https://graph.facebook.com/v21.0';

/** Lo que guardamos de un número tras verificarlo con Meta. Nada de esto es secreto. */
export interface DatosDeMeta {
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  name_status?: string;
  checked_at: string;
}

export interface Credenciales {
  phone_number_id?: string;
  waba_id?: string;
  access_token?: string;
}

/**
 * WhatsApp de cada clínica, configurado por el equipo de la plataforma.
 *
 * Dos formas de conectarla:
 * - Número de Dentral: el del servidor (WHATSAPP_PHONE_NUMBER_ID). Lo tiene
 *   una sola clínica a la vez; asignarlo a otra se lo quita a la anterior.
 *   Se guarda como integración con mode 'dentral' y external_id = ese número,
 *   así el enrutador del agente la encuentra por la vía normal. Los envíos
 *   salen con las credenciales del servidor, porque no hay propias.
 * - Número propio: su phone_number_id, su cuenta de WhatsApp Business (WABA)
 *   y, si no la compartió con Dentral, su propio token. Van cifrados.
 *
 * Antes la configuraba la clínica en su panel y solo se le pedía el
 * phone_number_id: no había forma de saber si el número era el que decía,
 * ni de suscribir su cuenta a nuestros webhooks, que es lo que hace que los
 * mensajes lleguen.
 */
@Injectable()
export class PlatformWhatsAppService {
  private readonly logger = new Logger(PlatformWhatsAppService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get numeroDentral(): string | null {
    return process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null;
  }

  private get tokenDentral(): string | null {
    return process.env.WHATSAPP_ACCESS_TOKEN?.trim() || null;
  }

  private get clave(): string {
    const s = process.env.JWT_ACCESS_SECRET;
    if (!s) throw new Error('JWT_ACCESS_SECRET no está configurado');
    return s;
  }

  async estado(clinicId: string) {
    await this.exigirClinica(clinicId);
    const integracion = await this.prisma.clinicIntegration.findUnique({
      where: { clinicId_type: { clinicId, type: 'WHATSAPP' } },
    });
    const cred = (integracion?.credentials as any) || {};
    const secretos = this.descifrar(cred);
    const modo: 'dentral' | 'own' | null = cred.mode === 'dentral' ? 'dentral' : cred.encrypted_data ? 'own' : null;

    return {
      mode: modo,
      phone_number_id: modo === 'dentral' ? this.numeroDentral : secretos.phone_number_id ?? null,
      waba_id: secretos.waba_id ?? null,
      has_own_token: Boolean(secretos.access_token),
      connected: integracion?.connected === true,
      last_tested_at: integracion?.lastTestedAt ?? null,
      last_test_ok: integracion?.lastTestOk ?? null,
      last_error: cred.last_error ?? null,
      meta: (cred.meta as DatosDeMeta) ?? null,
      webhooks: cred.webhooks ?? null,
      dentral_number: await this.duenoDelNumeroDentral(),
    };
  }

  /** Le da a la clínica el número de Dentral, quitándoselo a quien lo tuviera. */
  async asignarNumeroDentral(clinicId: string) {
    await this.exigirClinica(clinicId);
    const numero = this.numeroDentral;
    if (!numero) throw new BadRequestException('El servidor no tiene número de Dentral (WHATSAPP_PHONE_NUMBER_ID).');

    await this.prisma.$transaction(async (tx) => {
      const anterior = await tx.clinicIntegration.findUnique({ where: { externalId: numero } });
      if (anterior && anterior.clinicId !== clinicId) {
        await tx.clinicIntegration.update({
          where: { id: anterior.id },
          data: { externalId: null, credentials: {}, connected: false, lastTestOk: null, lastTestedAt: null },
        });
        this.logger.warn(`Número de Dentral retirado de la clínica ${anterior.clinicId}.`);
      }
      await tx.clinicIntegration.upsert({
        where: { clinicId_type: { clinicId, type: 'WHATSAPP' } },
        create: { clinicId, type: 'WHATSAPP', externalId: numero, credentials: { mode: 'dentral' }, connected: false },
        update: { externalId: numero, credentials: { mode: 'dentral' }, connected: false, lastTestOk: null, lastTestedAt: null },
      });
    });
    this.logger.log(`Número de Dentral asignado a la clínica ${clinicId}.`);
    return this.verificar(clinicId);
  }

  /** Número propio de la clínica. El token es opcional: sin él se usa el de Dentral. */
  async configurarPropio(clinicId: string, datos: Credenciales) {
    await this.exigirClinica(clinicId);
    const phone = String(datos.phone_number_id || '').trim();
    const waba = String(datos.waba_id || '').trim();
    if (!/^\d{6,25}$/.test(phone)) {
      throw new BadRequestException('El ID del número son solo dígitos (lo ves en Meta → WhatsApp → Configuración de la API).');
    }
    if (waba && !/^\d{6,25}$/.test(waba)) throw new BadRequestException('El ID de la cuenta de WhatsApp Business son solo dígitos.');
    if (phone === this.numeroDentral) {
      throw new BadRequestException('Ese es el número de Dentral: usa "Usar el número de Dentral".');
    }

    const actual = await this.prisma.clinicIntegration.findUnique({
      where: { clinicId_type: { clinicId, type: 'WHATSAPP' } },
    });
    const previos = this.descifrar(actual?.credentials as any);
    // Un token vacío conserva el que había; para quitarlo, se desconecta.
    const token = String(datos.access_token || '').trim() || previos.access_token;
    const secretos: Credenciales = { phone_number_id: phone, ...(waba ? { waba_id: waba } : {}), ...(token ? { access_token: token } : {}) };

    try {
      await this.prisma.clinicIntegration.upsert({
        where: { clinicId_type: { clinicId, type: 'WHATSAPP' } },
        create: {
          clinicId,
          type: 'WHATSAPP',
          externalId: phone,
          credentials: { mode: 'own', encrypted_data: encryptAES256(JSON.stringify(secretos), this.clave) },
          connected: false,
        },
        update: {
          externalId: phone,
          credentials: { mode: 'own', encrypted_data: encryptAES256(JSON.stringify(secretos), this.clave) },
          connected: false,
          lastTestOk: null,
          lastTestedAt: null,
        },
      });
    } catch (e) {
      if ((e as any)?.code === 'P2002') throw new ConflictException('Ese número ya está conectado a otra clínica.');
      throw e;
    }
    return this.verificar(clinicId);
  }

  /** Pregunta a Meta por el número y guarda lo que responde. */
  async verificar(clinicId: string) {
    const { integracion, phone, token } = await this.credencialesEfectivas(clinicId);
    const cred = (integracion.credentials as any) || {};
    const ahora = new Date();
    let ok = false;
    let error: string | null = null;
    let meta: DatosDeMeta | null = cred.meta ?? null;

    if (!token) {
      error = 'No hay token: ni propio de la clínica ni de Dentral (WHATSAPP_ACCESS_TOKEN).';
    } else {
      const r = await this.graph('GET', `/${phone}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status`, token);
      if (r.ok) {
        ok = true;
        meta = {
          display_phone_number: r.data.display_phone_number,
          verified_name: r.data.verified_name,
          quality_rating: r.data.quality_rating,
          code_verification_status: r.data.code_verification_status,
          name_status: r.data.name_status,
          checked_at: ahora.toISOString(),
        };
      } else {
        error = r.error;
      }
    }

    await this.prisma.clinicIntegration.update({
      where: { id: integracion.id },
      data: {
        connected: ok,
        lastTestOk: ok,
        lastTestedAt: ahora,
        credentials: { ...cred, meta, last_error: error },
      },
    });
    return this.estado(clinicId);
  }

  /**
   * Suscribe la cuenta de WhatsApp Business de la clínica a la app de Dentral.
   * Sin esto Meta no nos manda los mensajes de ese número: el agente nunca se
   * entera de que le escribieron. Con el número de Dentral ya está hecho.
   */
  async suscribirWebhooks(clinicId: string) {
    const { integracion, token, waba } = await this.credencialesEfectivas(clinicId);
    const cred = (integracion.credentials as any) || {};
    if (cred.mode === 'dentral') throw new BadRequestException('El número de Dentral ya está suscrito.');
    if (!waba) throw new BadRequestException('Falta el ID de la cuenta de WhatsApp Business (WABA) de la clínica.');
    if (!token) throw new BadRequestException('No hay token para hablar con Meta.');

    const alta = await this.graph('POST', `/${waba}/subscribed_apps`, token);
    const ahora = new Date().toISOString();
    const webhooks = alta.ok
      ? { subscribed: true, checked_at: ahora, error: null }
      : { subscribed: false, checked_at: ahora, error: alta.error };

    await this.prisma.clinicIntegration.update({
      where: { id: integracion.id },
      data: { credentials: { ...cred, webhooks } },
    });
    if (!alta.ok) throw new BadRequestException(`Meta rechazó la suscripción: ${alta.error}`);
    return this.estado(clinicId);
  }

  async desconectar(clinicId: string) {
    await this.exigirClinica(clinicId);
    await this.prisma.clinicIntegration.deleteMany({ where: { clinicId, type: 'WHATSAPP' } });
    this.logger.log(`WhatsApp desconectado de la clínica ${clinicId}.`);
    return this.estado(clinicId);
  }

  // ─── Internos ─────────────────────────────────────────────────────────

  private async exigirClinica(clinicId: string) {
    const c = await this.prisma.clinic.findFirst({ where: { id: clinicId, internal: false }, select: { id: true } });
    if (!c) throw new NotFoundException('No existe esa clínica.');
  }

  /** Quién tiene hoy el número de Dentral: asignado aquí, o por la variable del servidor. */
  private async duenoDelNumeroDentral() {
    const numero = this.numeroDentral;
    if (!numero) return null;
    const asignada = await this.prisma.clinicIntegration.findUnique({
      where: { externalId: numero },
      select: { clinic: { select: { id: true, name: true } } },
    });
    if (asignada) return { phone_number_id: numero, holder: asignada.clinic, assigned_in: 'backoffice' as const };

    const porDefecto = process.env.WHATSAPP_DEFAULT_CLINIC_ID;
    const clinica = porDefecto
      ? await this.prisma.clinic.findUnique({ where: { id: porDefecto }, select: { id: true, name: true } })
      : await this.prisma.clinic.findFirst({ where: { internal: false }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
    return { phone_number_id: numero, holder: clinica, assigned_in: 'server' as const };
  }

  private async credencialesEfectivas(clinicId: string) {
    await this.exigirClinica(clinicId);
    const integracion = await this.prisma.clinicIntegration.findUnique({
      where: { clinicId_type: { clinicId, type: 'WHATSAPP' } },
    });
    if (!integracion) throw new BadRequestException('La clínica no tiene WhatsApp configurado.');
    const cred = (integracion.credentials as any) || {};
    if (cred.mode === 'dentral') {
      return { integracion, phone: this.numeroDentral || '', token: this.tokenDentral, waba: null as string | null };
    }
    const s = this.descifrar(cred);
    if (!s.phone_number_id) throw new BadRequestException('La clínica no tiene WhatsApp configurado.');
    return { integracion, phone: s.phone_number_id, token: s.access_token || this.tokenDentral, waba: s.waba_id ?? null };
  }

  private descifrar(cred: any): Credenciales {
    if (!cred?.encrypted_data) return {};
    try {
      return JSON.parse(decryptAES256(cred.encrypted_data, this.clave));
    } catch (e) {
      this.logger.error(`No se pudieron descifrar credenciales de WhatsApp: ${(e as Error).message}`);
      return {};
    }
  }

  private async graph(metodo: 'GET' | 'POST', ruta: string, token: string): Promise<{ ok: boolean; data?: any; error: string }> {
    try {
      const res = await fetch(`${GRAPH}${ruta}`, { method: metodo, headers: { Authorization: `Bearer ${token}` } });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, data, error: '' };
      return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, error: `No se pudo contactar a Meta: ${(e as Error).message}` };
    }
  }
}
