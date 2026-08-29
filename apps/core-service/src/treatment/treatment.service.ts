import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { CreateTreatmentDto, UpdateTreatmentDto, CreateOfferDto } from './dto/treatment.dto';

@Injectable()
export class TreatmentService {
  private readonly logger = new Logger(TreatmentService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async findAll(clinicId: string, active?: boolean) {
    const treatments = await this.prisma.treatment.findMany({
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

    return Promise.all(
      treatments.map((t) => this.mapTreatmentToFrontend(t))
    );
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

    return this.mapTreatmentToFrontend(treatment);
  }

  async create(clinicId: string, dto: CreateTreatmentDto) {
    this.logger.log(`create - Creating treatment: "${dto.name}" under clinicId: ${clinicId}`);
    
    const category = dto.category || 'General';
    const durationAvgMin = dto.duration_avg_min ?? dto.duration_min ?? 15;
    
    const encyclopediaRef = dto.encyclopedia_ref && dto.encyclopedia_ref.trim() !== ''
      ? dto.encyclopedia_ref
      : null;

    let doctorIds = dto.doctor_ids || [];
    if (dto.doctors && dto.doctors.length > 0) {
      doctorIds = dto.doctors.map((d: any) => typeof d === 'string' ? d : d.id).filter(Boolean);
    }

    return this.prisma.$transaction(async (tx) => {
      const treatment = await tx.treatment.create({
        data: {
          name: dto.name,
          category,
          durationAvgMin,
          durationMin: dto.duration_min ?? null,
          description: dto.description ?? null,
          price: dto.price ?? null,
          priceIsapre: dto.price_isapre ?? dto.price ?? null,
          priceFonasa: dto.price_fonasa ?? dto.price ?? null,
          acceptsIsapre: dto.accepts_isapre ?? false,
          acceptsFonasa: dto.accepts_fonasa ?? false,
          encyclopediaRef,
          active: dto.active ?? true,
          clinicId,
        },
      });

      if (doctorIds.length > 0) {
        await tx.doctorTreatment.createMany({
          data: doctorIds.map((doctorId) => ({
            clinicId,
            doctorId,
            treatmentId: treatment.id,
          })),
        });
      }

      // Crear oferta de tratamiento por defecto (Precio Base)
      const price = dto.price ?? dto.price_isapre ?? dto.price_fonasa ?? 0;
      await tx.treatmentOffer.create({
        data: {
          clinicId,
          treatmentId: treatment.id,
          label: 'Precio Base',
          price: Math.round(price),
          active: true,
        },
      });

      return treatment;
    });
  }

  async update(clinicId: string, id: string, dto: UpdateTreatmentDto) {
    this.logger.log(`update - Updating treatment: ${id} under clinicId: ${clinicId}`);
    
    const durationAvgMin = dto.duration_avg_min ?? dto.duration_min;
    
    let encyclopediaRef = undefined;
    if (dto.encyclopedia_ref !== undefined) {
      encyclopediaRef = dto.encyclopedia_ref && dto.encyclopedia_ref.trim() !== ''
        ? dto.encyclopedia_ref
        : null;
    }

    let doctorIds = dto.doctor_ids;
    if (dto.doctors !== undefined) {
      doctorIds = dto.doctors.map((d: any) => typeof d === 'string' ? d : d.id).filter(Boolean);
    }

    // Verificar existencia
    await this.findOne(clinicId, id);

    return this.prisma.$transaction(async (tx) => {
      const treatment = await tx.treatment.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(durationAvgMin !== undefined ? { durationAvgMin } : {}),
          ...(dto.duration_min !== undefined ? { durationMin: dto.duration_min } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.price_isapre !== undefined ? { priceIsapre: dto.price_isapre } : {}),
          ...(dto.price_fonasa !== undefined ? { priceFonasa: dto.price_fonasa } : {}),
          ...(dto.accepts_isapre !== undefined ? { acceptsIsapre: dto.accepts_isapre } : {}),
          ...(dto.accepts_fonasa !== undefined ? { acceptsFonasa: dto.accepts_fonasa } : {}),
          ...(encyclopediaRef !== undefined ? { encyclopediaRef } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });

      if (doctorIds !== undefined) {
        await tx.doctorTreatment.deleteMany({
          where: { treatmentId: id },
        });

        if (doctorIds.length > 0) {
          await tx.doctorTreatment.createMany({
            data: doctorIds.map((dId) => ({
              clinicId,
              doctorId: dId,
              treatmentId: id,
            })),
          });
        }
      }

      // Crear/actualizar la oferta del precio base
      const price = dto.price ?? dto.price_isapre ?? dto.price_fonasa;
      if (price !== undefined) {
        const existingOffer = await tx.treatmentOffer.findFirst({
          where: { treatmentId: id, label: 'Precio Base', clinicId },
        });

        if (existingOffer) {
          await tx.treatmentOffer.update({
            where: { id: existingOffer.id },
            data: { price: Math.round(price) },
          });
        } else {
          await tx.treatmentOffer.create({
            data: {
              clinicId,
              treatmentId: id,
              label: 'Precio Base',
              price: Math.round(price),
              active: true,
            },
          });
        }
      }

      return treatment;
    });
  }

  async remove(clinicId: string, id: string) {
    this.logger.log(`remove - Deactivating treatment: ${id} under clinicId: ${clinicId}`);
    await this.findOne(clinicId, id);

    return this.prisma.treatment.update({
      where: { id },
      data: { active: false },
    });
  }

  private mapOfferToFrontend(o: any, basePrice: number) {
    const computedDiscount = basePrice > 0 && o.price != null && o.price < basePrice
      ? Math.round((1 - o.price / basePrice) * 100)
      : 0;
    const discount_pct = o.discountPct ?? computedDiscount;
    const fixed_price = o.fixedPrice ?? o.price ?? 0;

    return {
      id: o.id,
      label: o.label,
      discount_pct,
      fixed_price,
      valid_from: o.validFrom
        ? o.validFrom.toISOString()
        : (o.createdAt ? o.createdAt.toISOString() : new Date().toISOString()),
      valid_until: o.validUntil ? o.validUntil.toISOString() : '',
      active: o.active ?? true,
      price: o.price ?? fixed_price,
    };
  }

  private async mapTreatmentToFrontend(t: any): Promise<any> {
    const baseOffer = t.offers?.find((o: any) => o.label === 'Precio Base') || t.offers?.[0];
    const price = t.price ?? (baseOffer ? baseOffer.price : 0) ?? 0;

    let description = '';
    if (t.encyclopediaRef) {
      const entry = await this.prisma.dentalEntry.findUnique({
        where: { id: t.encyclopediaRef },
      });
      if (entry) {
        description = entry.description;
      }
    }

    const doctors = t.doctors
      ?.filter((dt: any) => dt.doctor.active !== false)
      ?.map((dt: any) => ({
        id: dt.doctor.id,
        name: dt.doctor.name,
        title: dt.doctor.title,
        specialty: dt.doctor.title,
        active: dt.doctor.active,
      })) || [];

    const mappedOffers = t.offers?.map((o: any) => this.mapOfferToFrontend(o, price)) || [];

    return {
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description || description,
      duration_min: t.durationMin ?? t.durationAvgMin ?? 15,
      price,
      price_isapre: t.priceIsapre ?? price,
      price_fonasa: t.priceFonasa ?? price,
      accepts_isapre: t.acceptsIsapre ?? true,
      accepts_fonasa: t.acceptsFonasa ?? true,
      active: t.active ?? true,
      encyclopedia_ref: t.encyclopediaRef || '',
      doctors,
      offers: mappedOffers,
    };
  }

  // --- OFFERS ---
  async createOffer(clinicId: string, treatmentId: string, dto: CreateOfferDto) {
    const treatment = await this.findOne(clinicId, treatmentId);

    // Get base price from the base offer of the treatment
    const baseOffer = treatment.offers?.find((o: any) => o.label === 'Precio Base') || treatment.offers?.[0];
    const basePrice = baseOffer ? baseOffer.price : 0;

    let computedPrice = 0;
    if (dto.fixed_price !== undefined && dto.fixed_price > 0) {
      computedPrice = dto.fixed_price;
    } else if (dto.discount_pct !== undefined && dto.discount_pct > 0) {
      computedPrice = Math.round(basePrice * (1 - dto.discount_pct / 100));
    } else if (dto.price !== undefined) {
      computedPrice = dto.price;
    }

    const offer = await this.prisma.treatmentOffer.create({
      data: {
        label: dto.label,
        price: Math.round(computedPrice),
        discountPct: dto.discount_pct ?? null,
        fixedPrice: dto.fixed_price ?? null,
        active: dto.active ?? true,
        validFrom: dto.valid_from ? new Date(dto.valid_from) : null,
        validUntil: dto.valid_until ? new Date(dto.valid_until) : null,
        treatmentId,
        clinicId,
      },
    });

    return this.mapOfferToFrontend(offer, basePrice);
  }

  async deleteOffer(clinicId: string, treatmentId: string, offerId: string) {
    const offer = await this.prisma.treatmentOffer.findFirst({
      where: { id: offerId, treatmentId, clinicId },
    });

    if (!offer) throw new NotFoundException('Oferta no encontrada');

    const updated = await this.prisma.treatmentOffer.update({
      where: { id: offerId },
      data: { active: false },
    });

    const treatment = await this.findOne(clinicId, treatmentId);
    const baseOffer = treatment.offers?.find((o: any) => o.label === 'Precio Base') || treatment.offers?.[0];
    const basePrice = baseOffer ? baseOffer.price : 0;

    return this.mapOfferToFrontend(updated, basePrice);
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
