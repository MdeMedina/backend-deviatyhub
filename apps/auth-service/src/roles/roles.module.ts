import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule implements OnModuleInit {
  private readonly logger = new Logger(RolesModule.name);

  onModuleInit() {
    this.logger.log('RolesModule initialized');
  }
}

