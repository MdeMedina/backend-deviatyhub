import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';

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
}
