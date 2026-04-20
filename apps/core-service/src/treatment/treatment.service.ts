import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { CreateTreatmentDto, UpdateTreatmentDto, CreateOfferDto } from './dto/treatment.dto';

@Injectable()
export class TreatmentService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async findAll(clinicId: string, active?: boolean) {
    return this.prisma.treatment.findMany({
      where: {
        clinicId,
        ...(active !== undefined ? { active } : {}),
      },
      include: {
        offers: {
          where: { active: true },
        },
        doctors: {
          include: {
            doctor: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(clinicId: string, id: string) {
    const treatment = await this.prisma.treatment.findFirst({
      where: { id, clinicId },
      include: {
        offers: true,
        doctors: {
          include: {
            doctor: true,
          },
        },
      },
    });

    if (!treatment) {
      throw new NotFoundException('Tratamiento no encontrado');
    }

    return treatment;
  }

  async create(clinicId: string, dto: CreateTreatmentDto) {
    const { doctor_ids, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      const treatment = await tx.treatment.create({
        data: {
          ...data,
          clinicId,
        },
      });

      if (doctor_ids && doctor_ids.length > 0) {
        await tx.doctorTreatment.createMany({
          data: doctor_ids.map((doctorId) => ({
            clinicId,
            doctorId,
            treatmentId: treatment.id,
          })),
        });
      }

      return treatment;
    });
  }

  async update(clinicId: string, id: string, dto: UpdateTreatmentDto) {
    const { doctor_ids, ...data } = dto;

    await this.findOne(clinicId, id);

    return this.prisma.$transaction(async (tx) => {
      const treatment = await tx.treatment.update({
        where: { id },
        data,
      });

      if (doctor_ids !== undefined) {
        await tx.doctorTreatment.deleteMany({
          where: { treatmentId: id },
        });

        if (doctor_ids.length > 0) {
          await tx.doctorTreatment.createMany({
            data: doctor_ids.map((dId) => ({
              clinicId,
              doctorId: dId,
              treatmentId: id,
            })),
          });
        }
      }

      return treatment;
    });
  }

  async remove(clinicId: string, id: string) {
    await this.findOne(clinicId, id);

    return this.prisma.treatment.update({
      where: { id },
      data: { active: false },
    });
  }

  // --- OFFERS ---
  async createOffer(clinicId: string, treatmentId: string, dto: CreateOfferDto) {
    await this.findOne(clinicId, treatmentId);

    return this.prisma.treatmentOffer.create({
      data: {
        ...dto,
        treatmentId,
        clinicId,
      },
    });
  }

  async deleteOffer(clinicId: string, treatmentId: string, offerId: string) {
    const offer = await this.prisma.treatmentOffer.findFirst({
      where: { id: offerId, treatmentId, clinicId },
    });

    if (!offer) throw new NotFoundException('Oferta no encontrada');

    return this.prisma.treatmentOffer.update({
      where: { id: offerId },
      data: { active: false },
    });
  }

  // --- ENCYCLOPEDIA ---
  async getEncyclopedia(category?: string, search?: string) {
    return this.prisma.dentalEntry.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
    });
  }
}
