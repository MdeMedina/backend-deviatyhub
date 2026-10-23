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

  /**
   * Aviso operativo al equipo de una clínica (derivaciones, citas por pasar a
   * Dentalink). Sin plantilla: es texto corto y cambia más que los correos al
   * paciente.
   */
  async sendTeamAlert(to: string[], subject: string, lineas: string[], enlace?: { url: string; texto: string }) {
    if (!to.length) return false;
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html =
      `<div style="font-family:Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d2433">` +
      lineas.map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`).join('') +
      (enlace ? `<p style="margin:18px 0 0"><a href="${enlace.url}" style="background:#1f3a8a;color:#fff;padding:10px 16px;border-radius:7px;text-decoration:none">${esc(enlace.texto)}</a></p>` : '') +
      `<p style="margin:22px 0 0;color:#8a8f9c;font-size:13px">Dentral · aviso automático</p></div>`;
    try {
      await this.mailerService.sendMail({ to, subject, html, text: lineas.join('\n\n') + (enlace ? `\n\n${enlace.url}` : '') });
      this.logger.log(`Aviso al equipo enviado (${to.length} destinatario${to.length === 1 ? "" : "s"}).`);
      return true;
    } catch (error: any) {
      this.logger.error(`Error enviando aviso al equipo: ${error.message}`);
      return false;
    }
  }
}
