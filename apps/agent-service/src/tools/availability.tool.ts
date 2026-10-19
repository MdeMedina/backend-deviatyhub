import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { format } from 'date-fns';
import { calcularHorasLibres, ajustesDelAgente } from '@deviaty/shared-utils';

@Injectable()
export class AvailabilityTool {
  private readonly logger = new Logger(AvailabilityTool.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * El cálculo vive en shared-utils porque la agenda del panel hace la misma
   * pregunta. Cuando eran dos implementaciones, lo que veía la clínica en
   * pantalla y lo que el agente le ofrecía a un paciente podían no coincidir.
   */
  async getAvailableSlots(
    clinicId: string,
    date: Date,
    treatmentId?: string,
    doctorId?: string,
    /** Cita que se está moviendo: su hora actual no cuenta como ocupada. */
    excluirCitaId?: string,
  ): Promise<string[]> {
    this.logger.log(
      `Consultando disponibilidad para clínica ${clinicId} en fecha ${format(date, 'yyyy-MM-dd')} ` +
        `(Treatment: ${treatmentId || 'N/A'}, Doctor: ${doctorId || 'N/A'})`,
    );
    // Cuando ofrece el agente rigen la anticipación de la clínica y quedan
    // fuera los profesionales sin agenda abierta.
    const ajustes = ajustesDelAgente(
      (await this.prisma.agentConfig.findUnique({ where: { clinicId }, select: { settings: true } }))?.settings,
    );
    return calcularHorasLibres(this.prisma, clinicId, date, treatmentId, doctorId, {
      excluirCitaId,
      agente: { anticipacionMinDias: ajustes.anticipacionMinDias, anticipacionMaxDias: ajustes.anticipacionMaxDias },
    });
  }
}
