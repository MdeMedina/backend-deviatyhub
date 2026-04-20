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
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdatePermissionsDto } from './dto/roles.dto';
import { Auditable } from '../common/decorators/auditable.decorator';

@Controller('roles')
export class RolesController {
  constructor(
    @Inject(RolesService)
    private readonly rolesService: RolesService,
  ) {}

  @Post()
  @Auditable('role')
  create(
    @Headers('x-clinic-id') clinicId: string,
    @Headers('x-is-superadmin') isSuperadmin: string,
    @Body() createRoleDto: CreateRoleDto,
  ) {
    return this.rolesService.createRole(
      clinicId,
      createRoleDto,
      isSuperadmin === 'true',
    );
  }

  @Get()
  findAll(@Headers('x-clinic-id') clinicId: string) {
    return this.rolesService.findRolesByClinic(clinicId);
  }

  @Patch(':id')
  @Auditable('role')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
    @Body() updatePermissionsDto: UpdatePermissionsDto,
  ) {
    return this.rolesService.updatePermissions(id, clinicId, updatePermissionsDto);
  }

  @Delete(':id')
  @Auditable('role')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-clinic-id') clinicId: string,
  ) {
    return this.rolesService.deleteRole(id, clinicId);
  }
}
