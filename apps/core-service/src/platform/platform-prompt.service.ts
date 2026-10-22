import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import {
  HUELLA_BASE,
  MARCADORES_DEL_COMPORTAMIENTO,
  PROMPT_BLOQUE_FIJO,
  PROMPT_COMPORTAMIENTO_BASE,
  huellaDelPrompt,
  revisarComportamiento,
} from '@deviaty/shared-utils';

/**
 * Prompt del agente de cada clínica, editable solo desde el backoffice.
 * Se guarda por versiones: cada guardado crea una y la deja activa; se puede
 * volver a cualquiera o al prompt base del sistema.
 */
@Injectable()
export class PlatformPromptService {
  private readonly logger = new Logger(PlatformPromptService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async estado(clinicId: string) {
    await this.exigirClinica(clinicId);
    const versiones = await this.prisma.agentPromptVersion.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const activa = versiones.find((v) => v.active) ?? null;
    return {
      base: PROMPT_COMPORTAMIENTO_BASE,
      base_hash: HUELLA_BASE,
      fixed: PROMPT_BLOQUE_FIJO,
      markers: MARCADORES_DEL_COMPORTAMIENTO,
      active: activa ? this.version(activa) : null,
      // La versión activa se escribió sobre un prompt base que ya cambió:
      // no incluye las mejoras posteriores del sistema.
      base_changed: !!activa && activa.baseHash !== HUELLA_BASE,
      versions: versiones.map((v) => this.version(v)),
    };
  }

  revisar(content: string) {
    return revisarComportamiento(content);
  }

  async guardar(clinicId: string, content: string, note: string | undefined, autor: { id?: string; email?: string }) {
    await this.exigirClinica(clinicId);
    const revision = revisarComportamiento(content);
    if (revision.errores.length) throw new BadRequestException(revision.errores.join(' '));

    const version = await this.prisma.$transaction(async (tx) => {
      await tx.agentPromptVersion.updateMany({ where: { clinicId, active: true }, data: { active: false } });
      return tx.agentPromptVersion.create({
        data: {
          clinicId,
          content,
          note: note?.trim() || null,
          baseHash: HUELLA_BASE,
          active: true,
          createdById: autor.id ?? null,
          createdByEmail: autor.email ?? null,
        },
      });
    });
    this.logger.log(`Prompt de la clínica ${clinicId}: nueva versión ${version.id} (${autor.email ?? 'sin autor'}).`);
    return { ...(await this.estado(clinicId)), warnings: revision.avisos };
  }

  async activar(clinicId: string, versionId: string) {
    const v = await this.prisma.agentPromptVersion.findFirst({ where: { id: versionId, clinicId } });
    if (!v) throw new NotFoundException('No existe esa versión.');
    await this.prisma.$transaction([
      this.prisma.agentPromptVersion.updateMany({ where: { clinicId, active: true }, data: { active: false } }),
      this.prisma.agentPromptVersion.update({ where: { id: versionId }, data: { active: true } }),
    ]);
    this.logger.log(`Prompt de la clínica ${clinicId}: se vuelve a la versión ${versionId}.`);
    return this.estado(clinicId);
  }

  /** Vuelve al prompt base del sistema. Las versiones quedan guardadas. */
  async usarBase(clinicId: string) {
    await this.exigirClinica(clinicId);
    await this.prisma.agentPromptVersion.updateMany({ where: { clinicId, active: true }, data: { active: false } });
    this.logger.log(`Prompt de la clínica ${clinicId}: vuelve al prompt base.`);
    return this.estado(clinicId);
  }

  private version(v: any) {
    return {
      id: v.id,
      content: v.content,
      note: v.note,
      active: v.active,
      created_at: v.createdAt,
      created_by: v.createdByEmail,
      based_on_current: v.baseHash === HUELLA_BASE,
      same_as_base: huellaDelPrompt(v.content) === HUELLA_BASE,
    };
  }

  private async exigirClinica(clinicId: string) {
    const c = await this.prisma.clinic.findFirst({ where: { id: clinicId, internal: false }, select: { id: true } });
    if (!c) throw new NotFoundException('No existe esa clínica.');
  }
}
