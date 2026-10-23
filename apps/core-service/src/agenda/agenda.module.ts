import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { DentalinkModule } from '../dentalink/dentalink.module';

@Module({
  imports: [DentalinkModule],
  controllers: [AgendaController],
  providers: [AgendaService],
})
export class AgendaModule implements OnModuleInit {
  private readonly logger = new Logger(AgendaModule.name);

  onModuleInit() {
    this.logger.log('AgendaModule initialized');
  }
}

