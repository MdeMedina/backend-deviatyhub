import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@deviaty/shared-events';
import { PrismaService } from '@deviaty/shared-prisma';
import axios from 'axios';

@Injectable()
export class WhatsAppSenderService {
  private readonly logger = new Logger('WhatsAppSenderService');

  constructor(
    private readonly eventBus: EventBus,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.setupSubscription();
  }

  private async setupSubscription() {
    this.logger.log('🚀 WhatsApp Sender Service inicializado. Escuchando outbound...');
    await this.eventBus.subscribe('message.outbound', async (payload: any) => {
      await this.sendToMeta(payload);
    });
  }

  private async sendToMeta(event: any) {
    const { recipient, content, conversationId, clinicId } = event;
    const phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = this.configService.get('WHATSAPP_ACCESS_TOKEN');

    if (!phoneNumberId || !accessToken) {
      await this.logFailure(conversationId, clinicId, content, 'MISSING_CREDENTIALS');
      return;
    }

    try {
      await axios.post(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'text',
          text: { body: content },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      this.logger.log(`✅ Mensaje enviado a ${recipient}`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      await this.logFailure(conversationId, clinicId, content, errorMsg);
    }
  }

  private async logFailure(conversationId: string, clinicId: string, content: string, reason: string) {
    await this.prisma.message.create({
      data: {
        conversationId,
        clinicId,
        role: 'SYSTEM',
        content: `Error de entrega: ${reason}`,
        sentAt: new Date(),
        langchainMeta: { status: 'FAILED', originalContent: content } as any
      }
    });
  }
}
