import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendInvitation(email: string, name: string, clinicName: string, inviteLink: string) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Te han invitado a ${clinicName} via Deviaty`,
        template: 'invitation',
        context: {
          name,
          clinicName,
          inviteLink,
        },
      });
      this.logger.log(`Email de invitación enviado a ${email}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Error enviando invitación a ${email}: ${error.message}`);
      return false;
    }
  }

  async sendAppointmentConfirmation(email: string, data: {
    patientName: string;
    clinicName: string;
    doctorName: string;
    treatmentName: string;
    date: string;
    time: string;
    location?: string;
  }) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Confirmación de cita: ${data.treatmentName} en ${data.clinicName}`,
        template: 'appointment-confirmation',
        context: data,
      });
      this.logger.log(`Confirmación de cita enviada a ${email}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Error enviando confirmación a ${email}: ${error.message}`);
      return false;
    }
  }
}
