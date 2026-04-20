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
import { TreatmentService } from './treatment.service';
import { CreateTreatmentDto, UpdateTreatmentDto, CreateOfferDto } from './dto/treatment.dto';

@Controller('treatments')
export class TreatmentController {
  constructor(
    @Inject(TreatmentService)
    private readonly treatmentService: TreatmentService
  ) {}

  @Get('encyclopedia')
  async getEncyclopedia(
    @Query('category') category?: string,
    @Query('search') search?: string
  ) {
    return this.treatmentService.getEncyclopedia(category, search);
  }

  @Get()
  async findAll(
    @CurrentClinicId() clinicId: string,
    @Query('active') active?: string
  ) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.treatmentService.findAll(clinicId, isActive);
  }

  @Get(':id')
  async findOne(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string
  ) {
    return this.treatmentService.findOne(clinicId, id);
  }

  @Post()
  @Auditable('treatment')
  async create(
    @CurrentClinicId() clinicId: string,
    @Body() dto: CreateTreatmentDto
  ) {
    return this.treatmentService.create(clinicId, dto);
  }

  @Patch(':id')
  @Auditable('treatment')
  async update(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTreatmentDto
  ) {
    return this.treatmentService.update(clinicId, id, dto);
  }

  @Delete(':id')
  @Auditable('treatment')
  async remove(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string
  ) {
    return this.treatmentService.remove(clinicId, id);
  }

  // --- OFFERS ---

  @Post(':id/offers')
  @Auditable('treatmentOffer')
  async createOffer(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: CreateOfferDto
  ) {
    return this.treatmentService.createOffer(clinicId, id, dto);
  }

  @Delete(':id/offers/:offerId')
  @Auditable('treatmentOffer')
  async deleteOffer(
    @CurrentClinicId() clinicId: string,
    @Param('id') treatmentId: string,
    @Param('offerId') offerId: string
  ) {
    return this.treatmentService.deleteOffer(clinicId, treatmentId, offerId);
  }
}
