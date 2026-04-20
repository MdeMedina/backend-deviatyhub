import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Inject,
} from '@nestjs/common';
import {
  Auditable,
  CurrentClinicId,
  CurrentUserId,
} from '@deviaty/shared-nestjs';
import { ConversationService } from './conversation.service';
import { ConversationFilterDto, ManualMessageDto } from './dto/conversation.dto';

@Controller('conversations')
export class ConversationController {
  constructor(
    @Inject(ConversationService)
    private readonly conversationService: ConversationService
  ) {}

  @Get()
  async findAll(
    @CurrentClinicId() clinicId: string,
    @Query() filters: ConversationFilterDto
  ) {
    return this.conversationService.findAll(clinicId, filters);
  }

  @Get('contacts')
  async findContacts(
    @CurrentClinicId() clinicId: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.conversationService.findContacts(
      clinicId,
      search,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  @Get(':id')
  async findOne(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string
  ) {
    return this.conversationService.findOne(clinicId, id);
  }

  @Post(':id/takeover')
  @Auditable('conversation')
  async takeover(
    @CurrentClinicId() clinicId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string
  ) {
    return this.conversationService.takeover(clinicId, id, userId);
  }

  @Post(':id/release')
  @Auditable('conversation')
  async release(
    @CurrentClinicId() clinicId: string,
    @Param('id') id: string
  ) {
    return this.conversationService.release(clinicId, id);
  }

  @Post(':id/message')
  @Auditable('message')
  async sendMessage(
    @CurrentClinicId() clinicId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: ManualMessageDto
  ) {
    return this.conversationService.sendManualMessage(clinicId, id, userId, dto.content);
  }
}
