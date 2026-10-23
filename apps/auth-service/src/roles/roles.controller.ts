import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  Inject,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdatePermissionsDto } from './dto/roles.dto';
import { Auditable } from '../common/decorators/auditable.decorator';
import { cargarActor } from '../common/actor';

@Controller('auth/roles')
export class RolesController {
  private readonly logger = new Logger(RolesController.name);

  constructor(
    @Inject(RolesService)
    private readonly rolesService: RolesService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('RolesController initialized');
  }

  @Post()
  @Auditable('role')
  async create(
    @Headers('x-clinic-id') clinicId: string,
    @Headers('x-user-id') userId: string,
    @Body() createRoleDto: CreateRoleDto,
  ) {
    this.logger.log(`Creating role: "${createRoleDto.name}" for clinicId: ${clinicId}`);
    // Quién es administrador se mira en la base (roles.is_superadmin), no en
    // la cabecera x-is-superadmin.
    const actor = await cargarActor(this.prisma, userId, clinicId);
    return this.rolesService.createRole(clinicId, actor, createRoleDto);
  }

  @Get()
  findAll(@Headers('x-clinic-id') clinicId: string) {
    this.logger.log(`Fetching all roles for clinicId: ${clinicId}`);
    return this.rolesService.findRolesByClinic(clinicId);
  }

  @Patch(':id')
  @Auditable('role')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
    @Headers('x-user-id') userId: string,
    @Body() updatePermissionsDto: UpdatePermissionsDto,
  ) {
    this.logger.log(`Updating permissions for role: ${id} under clinicId: ${clinicId}`);
    const actor = await cargarActor(this.prisma, userId, clinicId);
    return this.rolesService.updatePermissions(id, clinicId, actor, updatePermissionsDto);
  }

  @Delete(':id')
  @Auditable('role')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.logger.log(`Deleting role: ${id} under clinicId: ${clinicId}`);
    const actor = await cargarActor(this.prisma, userId, clinicId);
    return this.rolesService.deleteRole(id, clinicId, actor);
  }
}

