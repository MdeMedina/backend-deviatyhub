"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationListener = void 0;
const common_1 = require("@nestjs/common");
const shared_events_1 = require("@deviaty/shared-events");
const shared_prisma_1 = require("@deviaty/shared-prisma");
const config_1 = require("@nestjs/config");
const email_service_1 = require("../email/email.service");
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
let NotificationListener = NotificationListener_1 = class NotificationListener {
    eventBus;
    prisma;
    config;
    emailService;
    logger = new common_1.Logger(NotificationListener_1.name);
    constructor(eventBus, prisma, config, emailService) {
        this.eventBus = eventBus;
        this.prisma = prisma;
        this.config = config;
        this.emailService = emailService;
    }
    async onModuleInit() {
        this.logger.log('Inicializando Listeners de Notificaciones...');
        // 1. Escuchar invitaciones de usuarios
        this.eventBus.subscribe(shared_events_1.REDIS_CHANNELS.USER_INVITED, async (payload) => {
            this.logger.log(`Evento recibido: ${shared_events_1.REDIS_CHANNELS.USER_INVITED}`);
            const { email, name, clinicId, token } = payload;
            const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
            const clinicName = clinic?.name || 'Tu Clínica';
            const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
            const inviteLink = `${frontendUrl}/set-password?token=${token}`;
            await this.emailService.sendInvitation(email, name, clinicName, inviteLink);
        });
        // 2. Escuchar confirmaciones de citas
        this.eventBus.subscribe(shared_events_1.REDIS_CHANNELS.APPOINTMENT_SCHEDULED, async (payload) => {
            this.logger.log(`Evento recibido: ${shared_events_1.REDIS_CHANNELS.APPOINTMENT_SCHEDULED}`);
            const { appointmentId, clinicId } = payload;
            const appointment = await this.prisma.appointment.findUnique({
                where: { id: appointmentId },
                include: {
                    contact: true,
                    clinic: true,
                    doctor: true,
                    treatment: true,
                },
            });
            if (!appointment || !appointment.contact?.email) {
                this.logger.warn(`Cita ${appointmentId} no encontrada o sin email de contacto.`);
                return;
            }
            const scheduledAt = appointment.scheduledAt;
            await this.emailService.sendAppointmentConfirmation(appointment.contact.email, {
                patientName: appointment.contact.name || 'Paciente',
                clinicName: appointment.clinic.name,
                doctorName: appointment.doctor?.name || 'Especialista',
                treatmentName: appointment.treatment?.name || 'Tratamiento',
                date: (0, date_fns_1.format)(scheduledAt, "eeee d 'de' MMMM", { locale: locale_1.es }),
                time: (0, date_fns_1.format)(scheduledAt, 'HH:mm'),
                location: appointment.clinic.address, // Casting if address missing in type but present in DB
            });
        });
        this.logger.log('Listeners registrados exitosamente.');
    }
};
exports.NotificationListener = NotificationListener;
exports.NotificationListener = NotificationListener = NotificationListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_events_1.EventBus)),
    __metadata("design:paramtypes", [shared_events_1.EventBus,
        shared_prisma_1.PrismaService,
        config_1.ConfigService,
        email_service_1.EmailService])
], NotificationListener);
//# sourceMappingURL=notification.listener.js.map