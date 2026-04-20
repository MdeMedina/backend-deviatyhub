import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Inject,
} from '@nestjs/common';
import {
  Auditable,
  CurrentClinicId,
} from '@deviaty/shared-nestjs';
import { DoctorService } from './doctor.service';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';

@Controller('doctors')
export class DoctorController {
  constructor(
    @Inject(DoctorService)
    private readonly doctorService: DoctorService
  ) {}

  @Get()
  async findAll(
    @CurrentClinicId() clinicId: string,
    @Query('active') active?: string
  ) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.doctorService.findAll(clinicId, isActive);
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

  @Delete(':id')
  @Auditable('doctor')
  async remove(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string
  ) {
    return this.doctorService.remove(clinicId, id);
  }
}
