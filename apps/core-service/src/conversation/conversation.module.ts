import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { ConversationGateway } from './conversation.gateway';

@Module({
  controllers: [ConversationController],
  providers: [ConversationService, ConversationGateway],
  exports: [ConversationService, ConversationGateway],
})
export class ConversationModule implements OnModuleInit {
  private readonly logger = new Logger(ConversationModule.name);

  onModuleInit() {
    this.logger.log('ConversationModule initialized');
  }
}

