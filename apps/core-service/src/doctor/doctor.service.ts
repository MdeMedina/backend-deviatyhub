import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';
import { PutScheduleDto, CreateAbsenceDto } from './dto/schedule.dto';

@Injectable()
export class DoctorService {
  private readonly logger = new Logger(DoctorService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {
    this.logger.log('DoctorService initialized');
  }

  private mapDoctorToFrontend(d: any) {
    return {
      id: d.id,
      name: d.name,
      title: d.title,
      active: d.active,
      treatments: d.treatments?.map((dt: any) => ({
        id: dt.treatment.id,
        name: dt.treatment.name,
      })) || [],
    };
  }

  async findAll(clinicId: string, active?: boolean) {
    this.logger.log(`findAll - clinicId: ${clinicId}, active: ${active}`);
    const doctors = await this.prisma.doctor.findMany({
      where: {
        clinicId,
        ...(active !== undefined ? { active } : {}),
      },
      include: {
        treatments: {
          include: {
            treatment: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return doctors.map((d) => this.mapDoctorToFrontend(d));
  }

  async findOne(clinicId: string, id: string) {
    this.logger.log(`findOne - clinicId: ${clinicId}, doctorId: ${id}`);

    const doctor = await this.prisma.doctor.findFirst({
      where: { id, clinicId },
      include: {
        treatments: {
          include: {
            treatment: true,
          },
        },
      },
    });

    if (!doctor) {
      this.logger.warn(`findOne - Doctor not found. clinicId: ${clinicId}, doctorId: ${id}`);
      throw new NotFoundException('Doctor no encontrado');
    }

    return this.mapDoctorToFrontend(doctor);
  }

  async create(clinicId: string, dto: CreateDoctorDto) {
    this.logger.log(`create - Creating doctor for clinicId: ${clinicId}, name: ${dto.name}`);
    const { treatment_ids, treatments, ...data } = dto;

    let treatmentIds = treatment_ids;
    if (treatments !== undefined) {
      treatmentIds = treatments.map((t: any) => typeof t === 'string' ? t : t.id).filter(Boolean);
    }

    const doctor = await this.prisma.$transaction(async (tx) => {
      const created = await tx.doctor.create({
        data: {
          ...data,
          clinicId,
        },
      });

      if (treatmentIds && treatmentIds.length > 0) {
        this.logger.log(`create - Linking ${treatmentIds.length} treatments for doctor: ${created.id}`);
        await tx.doctorTreatment.createMany({
          data: treatmentIds.map((treatmentId) => ({
            clinicId,
            doctorId: created.id,
            treatmentId,
          })),
        });
      }

      return created;
    });

    return this.findOne(clinicId, doctor.id);
  }

  async update(clinicId: string, id: string, dto: UpdateDoctorDto) {
    this.logger.log(`update - Updating doctor: ${id} under clinicId: ${clinicId}`);
    const { treatment_ids, treatments, ...data } = dto;

    let treatmentIds = treatment_ids;
    if (treatments !== undefined) {
      treatmentIds = treatments.map((t: any) => typeof t === 'string' ? t : t.id).filter(Boolean);
    }

    // Verificar existencia
    await this.findOne(clinicId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.doctor.update({
        where: { id },
        data,
      });

      if (treatmentIds !== undefined) {
        this.logger.log(`update - Re-linking treatments for doctor: ${id}. Count: ${treatmentIds.length}`);
        // Reemplazar tratamientos (Bulk delete + Create)
        await tx.doctorTreatment.deleteMany({
          where: { doctorId: id },
        });

        if (treatmentIds.length > 0) {
          await tx.doctorTreatment.createMany({
            data: treatmentIds.map((tId) => ({
              clinicId,
              doctorId: id,
              treatmentId: tId,
            })),
          });
        }
      }
    });

    return this.findOne(clinicId, id);
  }

  async remove(clinicId: string, id: string) {
    this.logger.log(`remove - Deactivating doctor: ${id} under clinicId: ${clinicId}`);
    await this.findOne(clinicId, id);

    return this.prisma.doctor.update({
      where: { id },
      data: { active: false },
    });
  }

  // ─── Jornada y ausencias ────────────────────────────────────────────────

  /** Ficha del profesional que corresponde al usuario conectado, si la hay. */
  async findByUser(clinicId: string, userId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { clinicId, userId },
      include: { treatments: { include: { treatment: true } } },
    });
    if (!doctor) {
      throw new NotFoundException('Tu usuario no está vinculado a ninguna ficha de profesional.');
    }
    return this.mapDoctorToFrontend(doctor);
  }

  /**
   * Un profesional solo puede gestionar SU jornada. Quien no tiene ficha de
   * doctor (administración) puede gestionar la de cualquiera: el permiso de
   * llegar hasta aquí ya lo decide el rol.
   */
  private async assertPuedeGestionar(clinicId: string, userId: string | undefined, doctorId: string) {
    await this.findOne(clinicId, doctorId);
    if (!userId) return;

    const suyo = await this.prisma.doctor.findFirst({
      where: { clinicId, userId },
      select: { id: true },
    });
    if (suyo && suyo.id !== doctorId) {
      throw new ForbiddenException('Solo puedes gestionar tu propia jornada.');
    }
  }

  async getSchedule(clinicId: string, doctorId: string) {
    await this.findOne(clinicId, doctorId);
    const blocks = await this.prisma.doctorSchedule.findMany({
      where: { clinicId, doctorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return blocks.map((b) => ({
      id: b.id,
      day_of_week: b.dayOfWeek,
      start_time: b.startTime,
      end_time: b.endTime,
      active: b.active,
    }));
  }

  async putSchedule(clinicId: string, doctorId: string, userId: string | undefined, dto: PutScheduleDto) {
    await this.assertPuedeGestionar(clinicId, userId, doctorId);

    const bloques = dto.blocks || [];
    for (const b of bloques) {
      if (b.start_time >= b.end_time) {
        throw new BadRequestException(
          `El tramo del día ${b.day_of_week} termina antes de empezar (${b.start_time}–${b.end_time}).`,
        );
      }
    }

    // Tramos solapados el mismo día: sin esto se duplicarían las horas libres.
    const porDia = new Map<number, { start_time: string; end_time: string }[]>();
    for (const b of bloques) {
      const lista = porDia.get(b.day_of_week) || [];
      if (lista.some((o) => b.start_time < o.end_time && b.end_time > o.start_time)) {
        throw new BadRequestException(`Hay tramos que se solapan en el día ${b.day_of_week}.`);
      }
      lista.push(b);
      porDia.set(b.day_of_week, lista);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.doctorSchedule.deleteMany({ where: { clinicId, doctorId } });
      if (bloques.length) {
        await tx.doctorSchedule.createMany({
          data: bloques.map((b) => ({
            clinicId,
            doctorId,
            dayOfWeek: b.day_of_week,
            startTime: b.start_time,
            endTime: b.end_time,
            active: b.active ?? true,
          })),
        });
      }
    });

    this.logger.log(`Jornada del profesional ${doctorId} actualizada: ${bloques.length} tramos.`);
    return this.getSchedule(clinicId, doctorId);
  }

  async getAbsences(clinicId: string, doctorId: string, from?: string, to?: string) {
    await this.findOne(clinicId, doctorId);
    const desde = from ? new Date(from) : new Date();
    const hasta = to ? new Date(to) : undefined;

    const absences = await this.prisma.doctorAbsence.findMany({
      where: {
        clinicId,
        doctorId,
        endsAt: { gte: desde },
        ...(hasta ? { startsAt: { lte: hasta } } : {}),
      },
      orderBy: { startsAt: 'asc' },
    });

    return absences.map((a) => ({
      id: a.id,
      starts_at: a.startsAt,
      ends_at: a.endsAt,
      all_day: a.allDay,
      reason: a.reason,
    }));
  }

  async createAbsence(clinicId: string, doctorId: string, userId: string | undefined, dto: CreateAbsenceDto) {
    await this.assertPuedeGestionar(clinicId, userId, doctorId);

    const startsAt = new Date(dto.starts_at);
    const endsAt = new Date(dto.ends_at);
    if (!(startsAt < endsAt)) {
      throw new BadRequestException('La ausencia termina antes de empezar.');
    }

    // Las citas ya reservadas dentro de la ausencia no se cancelan solas: eso
    // es una decisión de la clínica y afecta a pacientes que ya tienen su hora.
    // Se avisa de cuántas hay para que alguien las gestione.
    const afectadas = await this.prisma.appointment.count({
      where: {
        clinicId,
        doctorId,
        status: { not: 'CANCELLED' },
        scheduledAt: { gte: startsAt, lt: endsAt },
      },
    });

    const creada = await this.prisma.doctorAbsence.create({
      data: {
        clinicId,
        doctorId,
        startsAt,
        endsAt,
        allDay: dto.all_day ?? false,
        reason: dto.reason ?? null,
      },
    });

    if (afectadas > 0) {
      this.logger.warn(
        `La ausencia ${creada.id} del profesional ${doctorId} solapa con ${afectadas} cita(s) ya reservada(s).`,
      );
    }

    return {
      id: creada.id,
      starts_at: creada.startsAt,
      ends_at: creada.endsAt,
      all_day: creada.allDay,
      reason: creada.reason,
      citas_afectadas: afectadas,
    };
  }

  async removeAbsence(clinicId: string, doctorId: string, userId: string | undefined, absenceId: string) {
    await this.assertPuedeGestionar(clinicId, userId, doctorId);
    const existe = await this.prisma.doctorAbsence.findFirst({
      where: { id: absenceId, clinicId, doctorId },
    });
    if (!existe) throw new NotFoundException('Ausencia no encontrada.');

    await this.prisma.doctorAbsence.delete({ where: { id: absenceId } });
    return { id: absenceId, deleted: true };
  }
}
