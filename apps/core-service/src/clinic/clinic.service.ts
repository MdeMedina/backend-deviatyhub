import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService, Prisma } from '@deviaty/shared-prisma';
import {
  UpdateClinicConfigDto,
  UpdateSchedulesDto,
  CreateUnavailabilityDto,
  UpdateUnavailabilityDto,
  CreatePolicyDto,
  UpdatePolicyDto,
} from './dto/clinic.dto';

@Injectable()
export class ClinicService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  // --- CONFIG ---
  async getConfig(clinicId: string) {
    const config = await this.prisma.clinicConfig.findUnique({
      where: { clinicId },
    });
    if (!config) throw new NotFoundException('Clinic configuration not found');
    return config;
  }

  async updateConfig(clinicId: string, dto: UpdateClinicConfigDto) {
    return this.prisma.clinicConfig.upsert({
      where: { clinicId },
      create: {
        clinicId,
        name: dto.name || 'Nueva Clínica',
        address: dto.address || '',
        phone: dto.phone || '',
        email: dto.email || '',
        timezone: dto.timezone || 'UTC',
        language: dto.language || 'es',
      },
      update: {
        ...dto,
      },
    });
  }

  // --- SCHEDULES ---
  async getSchedules(clinicId: string) {
    return this.prisma.clinicSchedule.findMany({
      where: { clinicId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async updateSchedules(clinicId: string, dto: UpdateSchedulesDto) {
    // Usamos una transacción para resetear y actualizar los horarios
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.clinicSchedule.deleteMany({ where: { clinicId } });
      
      const data = dto.schedules.map((s) => ({
        clinicId,
        dayOfWeek: s.day_of_week,
        openTime: s.open_time,
        closeTime: s.close_time,
        isOpen: s.is_open ?? true,
      }));

      await tx.clinicSchedule.createMany({ data });
      return { message: 'Horarios actualizados correctamente' };
    });
  }

  // --- UNAVAILABILITY ---
  async getUnavailability(clinicId: string) {
    return this.prisma.unavailabilityBlock.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUnavailability(clinicId: string, dto: CreateUnavailabilityDto) {
    return this.prisma.unavailabilityBlock.create({
      data: {
        clinicId,
        name: dto.name,
        daysOfWeek: dto.days_of_week,
        startTime: dto.start_time,
        endTime: dto.end_time,
      },
    });
  }

  async updateUnavailability(clinicId: string, id: string, dto: UpdateUnavailabilityDto) {
    return this.prisma.unavailabilityBlock.update({
      where: { id, clinicId },
      data: {
        name: dto.name,
        daysOfWeek: dto.days_of_week,
        startTime: dto.start_time,
        endTime: dto.end_time,
        active: dto.active,
      },
    });
  }

  async deleteUnavailability(clinicId: string, id: string) {
    await this.prisma.unavailabilityBlock.delete({
      where: { id, clinicId },
    });
    return { message: 'Bloque eliminado correctamente' };
  }

  // --- POLICIES ---
  async getPolicies(clinicId: string) {
    return this.prisma.policy.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPolicy(clinicId: string, dto: CreatePolicyDto) {
    return this.prisma.policy.create({
      data: {
        clinicId,
        title: dto.title,
        description: dto.description,
      },
    });
  }

  async updatePolicy(clinicId: string, id: string, dto: UpdatePolicyDto) {
    return this.prisma.policy.update({
      where: { id, clinicId },
      data: {
        title: dto.title,
        description: dto.description,
        active: dto.active,
      },
    });
  }

  async deletePolicy(clinicId: string, id: string) {
    await this.prisma.policy.delete({
      where: { id, clinicId },
    });
    return { message: 'Política eliminada correctamente' };
  }
}
