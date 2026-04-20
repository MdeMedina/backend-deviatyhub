import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';

@Injectable()
export class DoctorService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async findAll(clinicId: string, active?: boolean) {
    return this.prisma.doctor.findMany({
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
  }

  async findOne(clinicId: string, id: string) {
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
      throw new NotFoundException('Doctor no encontrado');
    }

    return doctor;
  }

  async create(clinicId: string, dto: CreateDoctorDto) {
    const { treatment_ids, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      const doctor = await tx.doctor.create({
        data: {
          ...data,
          clinicId,
        },
      });

      if (treatment_ids && treatment_ids.length > 0) {
        await tx.doctorTreatment.createMany({
          data: treatment_ids.map((treatmentId) => ({
            clinicId,
            doctorId: doctor.id,
            treatmentId,
          })),
        });
      }

      return doctor;
    });
  }

  async update(clinicId: string, id: string, dto: UpdateDoctorDto) {
    const { treatment_ids, ...data } = dto;

    // Verificar existencia
    await this.findOne(clinicId, id);

    return this.prisma.$transaction(async (tx) => {
      const doctor = await tx.doctor.update({
        where: { id },
        data,
      });

      if (treatment_ids !== undefined) {
        // Reemplazar tratamientos (Bulk delete + Create)
        await tx.doctorTreatment.deleteMany({
          where: { doctorId: id },
        });

        if (treatment_ids.length > 0) {
          await tx.doctorTreatment.createMany({
            data: treatment_ids.map((tId) => ({
              clinicId,
              doctorId: id,
              treatmentId: tId,
            })),
          });
        }
      }

      return doctor;
    });
  }

  async remove(clinicId: string, id: string) {
    await this.findOne(clinicId, id);

    return this.prisma.doctor.update({
      where: { id },
      data: { active: false },
    });
  }
}
