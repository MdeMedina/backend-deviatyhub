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
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdatePermissionsDto } from './dto/roles.dto';
import { Auditable } from '../common/decorators/auditable.decorator';

@Controller('auth/roles')
export class RolesController {
  private readonly logger = new Logger(RolesController.name);

  constructor(
    @Inject(RolesService)
    private readonly rolesService: RolesService,
  ) {
    this.logger.log('RolesController initialized');
  }

  @Post()
  @Auditable('role')
  create(
    @Headers('x-clinic-id') clinicId: string,
    @Headers('x-is-superadmin') isSuperadmin: string,
    @Body() createRoleDto: CreateRoleDto,
  ) {
    this.logger.log(`Creating role: "${createRoleDto.name}" for clinicId: ${clinicId}`);
    return this.rolesService.createRole(
      clinicId,
      createRoleDto,
      isSuperadmin === 'true',
    );
  }

  @Get()
  findAll(@Headers('x-clinic-id') clinicId: string) {
    this.logger.log(`Fetching all roles for clinicId: ${clinicId}`);
    return this.rolesService.findRolesByClinic(clinicId);
  }

  @Patch(':id')
  @Auditable('role')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
    @Body() updatePermissionsDto: UpdatePermissionsDto,
  ) {
    this.logger.log(`Updating permissions for role: ${id} under clinicId: ${clinicId}`);
    return this.rolesService.updatePermissions(id, clinicId, updatePermissionsDto);
  }

  @Delete(':id')
  @Auditable('role')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
  ) {
    this.logger.log(`Deleting role: ${id} under clinicId: ${clinicId}`);
    return this.rolesService.deleteRole(id, clinicId);
  }
}

