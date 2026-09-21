import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  Logger,
} from '@nestjs/common';
import {
  Auditable,
  CurrentClinicId,
  CurrentUserId,
} from '@deviaty/shared-nestjs';
import { DoctorService } from './doctor.service';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';
import { PutScheduleDto, CreateAbsenceDto } from './dto/schedule.dto';

@Controller('doctors')
export class DoctorController {
  private readonly logger = new Logger(DoctorController.name);

  constructor(
    @Inject(DoctorService)
    private readonly doctorService: DoctorService
  ) {
    this.logger.log('DoctorController initialized');
  }

  @Get()
  async findAll(
    @CurrentClinicId() clinicId: string,
    @Query('active') active?: string
  ) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.doctorService.findAll(clinicId, isActive);
  }

  /**
   * Ficha del profesional conectado. Va antes que ':id' a propósito: Nest
   * resuelve por orden de declaración y si no, "me" entraría como un id.
   */
  @Get('me')
  async findMe(
    @CurrentClinicId() clinicId: string,
    @CurrentUserId() userId: string
  ) {
    return this.doctorService.findByUser(clinicId, userId);
  }

  @Get(':id')
  async findOne(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string
  ) {
    return this.doctorService.findOne(clinicId, id);
  }

  @Post()
  @Auditable('doctor')
  async create(
    @CurrentClinicId() clinicId: string,
    @Body() dto: CreateDoctorDto
  ) {
    return this.doctorService.create(clinicId, dto);
  }

  @Patch(':id')
  @Auditable('doctor')
  async update(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto
  ) {
    return this.doctorService.update(clinicId, id, dto);
  }

  @Put(':id')
  @Auditable('doctor')
  async updatePut(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto
  ) {
    return this.doctorService.update(clinicId, id, dto);
  }

  @Delete(':id')
  @Auditable('doctor')
  async remove(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string
  ) {
    return this.doctorService.remove(clinicId, id);
  }
  // ─── Jornada semanal ──────────────────────────────────────────────────

  @Get(':id/schedule')
  async getSchedule(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string
  ) {
    return this.doctorService.getSchedule(clinicId, id);
  }

  @Put(':id/schedule')
  @Auditable('doctor_schedule')
  async putSchedule(
    @CurrentClinicId() clinicId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: PutScheduleDto
  ) {
    return this.doctorService.putSchedule(clinicId, id, userId, dto);
  }

  // ─── Ausencias con fecha ──────────────────────────────────────────────

  @Get(':id/absences')
  async getAbsences(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.doctorService.getAbsences(clinicId, id, from, to);
  }

  @Post(':id/absences')
  @Auditable('doctor_absence')
  async createAbsence(
    @CurrentClinicId() clinicId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CreateAbsenceDto
  ) {
    return this.doctorService.createAbsence(clinicId, id, userId, dto);
  }

  @Delete(':id/absences/:absenceId')
  @Auditable('doctor_absence')
  async removeAbsence(
    @CurrentClinicId() clinicId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('absenceId') absenceId: string
  ) {
    return this.doctorService.removeAbsence(clinicId, id, userId, absenceId);
  }
}
