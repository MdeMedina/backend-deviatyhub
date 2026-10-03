import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformAdminGuard } from './platform.guard';
import { PlatformWhatsAppService } from './platform-whatsapp.service';

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, PlatformWhatsAppService, PlatformAdminGuard],
})
export class PlatformModule {}
