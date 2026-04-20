import { Controller, Get, Post } from '@nestjs/common';
import { RequirePermission } from './auth/decorators/permissions.decorator';

@Controller('test-perm')
export class TestPermissionsController {
  @Get('view')
  @RequirePermission('users.view')
  view() {
    return { ok: true };
  }

  @Post('edit')
  @RequirePermission('users.edit')
  edit() {
    return { ok: true };
  }
}
