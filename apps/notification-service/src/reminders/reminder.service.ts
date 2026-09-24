import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@deviaty/shared-prisma';
import { EventBus } from '@deviaty/shared-events';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { enviarYRegistrar } from '../outbound.util';

/**
 * Los tres avisos, del más lejano al más cercano.
 *
 * `campo` es la columna que marca el envío. Existían en la base desde el
 * principio pero ningún proceso las leía: nunca se había enviado un
 * recordatorio. El nombre reminder_1h_sent es histórico; el aviso de vísperas
 * se manda a 2 horas, que es lo que pidió la clínica. Se conserva el nombre
 * para no renombrar una columna en producción por una cuestión de etiqueta.
 */
const AVISOS = [
  { campo: 'reminder3dSent' as const, minutos: 3 * 24 * 60, etiqueta: '3 días' },
  { campo: 'reminder1dSent' as const, minutos: 24 * 60, etiqueta: '1 día' },
  { campo: 'reminder1hSent' as const, minutos: 2 * 60, etiqueta: '2 horas' },
];

@Injectable()
export class ReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EventBus) private readonly eventBus: EventBus,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const cadaMin = Number(this.config.get('REMINDER_INTERVAL_MIN')) || 5;

    // Un intervalo simple en vez de @nestjs/schedule: para una pasada periódica
    // no hace falta una dependencia nueva ni tocar el lockfile, que en el
    // despliegue es justo donde duelen las sorpresas.
    this.timer = setInterval(() => {
      this.revisar().catch((e) => this.logger.error(`Fallo revisando recordatorios: ${e.message}`));
    }, cadaMin * 60 * 1000);

    // Sin esto, un contenedor que se reinicia cada poco no enviaría nunca nada.
    setTimeout(() => {
      this.revisar().catch((e) => this.logger.error(`Fallo revisando recordatorios: ${e.message}`));
    }, 30_000);

    this.logger.log(`Recordatorios activos: revisión cada ${cadaMin} min.`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async revisar() {
    const ahora = new Date();
    // Recién reservada: el paciente acaba de hablar con nosotros y ya sabe
    // cuándo es. Mandarle un recordatorio al minuto siguiente es ruido.
    const margen = new Date(ahora.getTime() - 60 * 60 * 1000);
    const masLejano = new Date(ahora.getTime() + AVISOS[0].minutos * 60 * 1000);

    const citas = await this.prisma.appointment.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
        scheduledAt: { gt: ahora, lte: masLejano },
        createdAt: { lt: margen },
      },
      include: { contact: true, clinic: true, doctor: true, treatment: true },
    });

    for (const cita of citas) {
      try {
        await this.procesar(cita, ahora);
      } catch (e) {
        this.logger.error(`Recordatorio de la cita ${cita.id} falló: ${(e as Error).message}`);
      }
    }
  }

  private async procesar(cita: any, ahora: Date) {
    const faltanMin = (new Date(cita.scheduledAt).getTime() - ahora.getTime()) / 60000;

    // El aviso que toca es el MÁS CERCANO que ya corresponde. Los más lejanos
    // se dan por enviados aunque no salieran: una hora reservada para mañana
    // nunca tuvo un momento "3 días antes", y mandar los tres de golpe sería
    // tres mensajes seguidos por lo mismo.
    const aplicables = AVISOS.filter((a) => faltanMin <= a.minutos);
    if (!aplicables.length) return;

    const aEnviar = aplicables[aplicables.length - 1];
    if (cita[aEnviar.campo]) return; // ya salió

    const marcas: Record<string, boolean> = {};
    for (const a of aplicables) marcas[a.campo] = true;

    const telefono = cita.contact?.phone;
    if (!telefono) {
      // Igual se marca: sin teléfono no hay nada que reintentar en cada pasada.
      await this.prisma.appointment.update({ where: { id: cita.id }, data: marcas });
      this.logger.warn(`Cita ${cita.id} sin teléfono: recordatorio omitido.`);
      return;
    }

    await enviarYRegistrar(this.prisma, this.eventBus, this.logger, {
      recipient: telefono,
      content: this.mensaje(cita, aEnviar.etiqueta),
      conversationId: cita.conversationId ?? null,
      clinicId: cita.clinicId,
    });

    // Se marca DESPUÉS de publicar: si falla el envío, la siguiente pasada lo
    // reintenta en vez de darlo por hecho.
    await this.prisma.appointment.update({ where: { id: cita.id }, data: marcas });
    this.logger.log(`Recordatorio de ${aEnviar.etiqueta} enviado a ${telefono} (cita ${cita.id}).`);
  }

  private mensaje(cita: any, etiqueta: string): string {
    const cuando =
      `${format(cita.scheduledAt, "eeee d 'de' MMMM", { locale: es })} a las ` +
      `${format(cita.scheduledAt, 'HH:mm')}`;
    const nombre = cita.contact?.name ? ` ${cita.contact.name}` : '';
    const conQuien = cita.doctor?.name ? ` con *${cita.doctor.name}*` : '';

    const cabecera =
      etiqueta === '2 horas'
        ? `Hola${nombre}, te recordamos que tu hora es *hoy*`
        : `Hola${nombre}, te recordamos tu hora en *${cita.clinic?.name ?? 'la clínica'}*`;

    return (
      `${cabecera}.\n\n` +
      `*${cita.treatment?.name ?? 'Atención'}* el *${cuando}*${conQuien}.\n\n` +
      `Si no puedes asistir o necesitas cambiarla, respóndenos por aquí y lo vemos.`
    );
  }
}
