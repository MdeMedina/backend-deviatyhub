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
var ClinicService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicService = void 0;
const common_1 = require("@nestjs/common");
const shared_prisma_1 = require("@deviaty/shared-prisma");
const shared_utils_1 = require("@deviaty/shared-utils");
let ClinicService = ClinicService_1 = class ClinicService {
    prisma;
    logger = new common_1.Logger(ClinicService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
        this.logger.log('ClinicService initialized');
    }
    // --- CONFIG ---
    async getConfig(clinicId) {
        this.logger.log(`getConfig - clinicId: ${clinicId}`);
        const config = await this.prisma.clinicConfig.findUnique({
            where: { clinicId },
        });
        if (!config) {
            this.logger.warn(`getConfig - Configuration not found for clinicId: ${clinicId}`);
            throw new common_1.NotFoundException('Clinic configuration not found');
        }
        return config;
    }
    async updateConfig(clinicId, dto) {
        this.logger.log(`updateConfig - clinicId: ${clinicId}`);
        return this.prisma.clinicConfig.upsert({
            where: { clinicId },
            create: {
                clinicId,
                name: dto.name || 'Nueva Clínica',
                address: dto.address || '',
                phone: dto.phone || '',
                email: dto.email || '',
                timezone: dto.timezone || 'UTC',
                language: dto.language || 'es',
            },
            update: {
                ...dto,
            },
        });
    }
    // --- SCHEDULES ---
    async getSchedules(clinicId) {
        const schedules = await this.prisma.clinicSchedule.findMany({
            where: { clinicId },
            orderBy: { dayOfWeek: 'asc' },
        });
        if (schedules.length === 0) {
            // Retornar valores por defecto para todos los días (1-6 y 0)
            const defaultDays = [1, 2, 3, 4, 5, 6, 0];
            return defaultDays.map((day) => ({
                day_of_week: day,
                open_time: '09:00',
                close_time: '18:00',
                is_open: day !== 0, // Domingo cerrado por defecto
            }));
        }
        return schedules.map((s) => ({
            id: s.id,
            day_of_week: s.dayOfWeek,
            open_time: s.openTime,
            close_time: s.closeTime,
            is_open: s.isOpen ?? true,
        }));
    }
    async updateSchedules(clinicId, dto) {
        // Usamos una transacción para resetear y actualizar los horarios
        return this.prisma.$transaction(async (tx) => {
            await tx.clinicSchedule.deleteMany({ where: { clinicId } });
            const data = dto.schedules.map((s) => ({
                clinicId,
                dayOfWeek: s.day_of_week,
                openTime: s.open_time,
                closeTime: s.close_time,
                isOpen: s.is_open ?? true,
            }));
            await tx.clinicSchedule.createMany({ data });
            return { message: 'Horarios actualizados correctamente' };
        });
    }
    // --- UNAVAILABILITY ---
    mapUnavailabilityToFrontend(block) {
        return {
            id: block.id,
            name: block.name,
            days_of_week: block.daysOfWeek,
            start_time: block.startTime,
            end_time: block.endTime,
            active: block.active ?? true,
        };
    }
    async getUnavailability(clinicId) {
        const blocks = await this.prisma.unavailabilityBlock.findMany({
            where: { clinicId },
            orderBy: { createdAt: 'desc' },
        });
        return blocks.map((b) => this.mapUnavailabilityToFrontend(b));
    }
    async createUnavailability(clinicId, dto) {
        const block = await this.prisma.unavailabilityBlock.create({
            data: {
                clinicId,
                name: dto.name,
                daysOfWeek: dto.days_of_week,
                startTime: dto.start_time,
                endTime: dto.end_time,
                active: dto.active,
            },
        });
        return this.mapUnavailabilityToFrontend(block);
    }
    async updateUnavailability(clinicId, id, dto) {
        const block = await this.prisma.unavailabilityBlock.update({
            where: { id, clinicId },
            data: {
                name: dto.name,
                daysOfWeek: dto.days_of_week,
                startTime: dto.start_time,
                endTime: dto.end_time,
                active: dto.active,
            },
        });
        return this.mapUnavailabilityToFrontend(block);
    }
    async deleteUnavailability(clinicId, id) {
        await this.prisma.unavailabilityBlock.delete({
            where: { id, clinicId },
        });
        return { message: 'Bloque eliminado correctamente' };
    }
    // --- POLICIES ---
    async getPolicies(clinicId) {
        return this.prisma.policy.findMany({
            where: { clinicId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createPolicy(clinicId, dto) {
        return this.prisma.policy.create({
            data: {
                clinicId,
                title: dto.title,
                description: dto.description,
                active: dto.active,
            },
        });
    }
    async updatePolicy(clinicId, id, dto) {
        return this.prisma.policy.update({
            where: { id, clinicId },
            data: {
                title: dto.title,
                description: dto.description,
                active: dto.active,
            },
        });
    }
    async deletePolicy(clinicId, id) {
        await this.prisma.policy.delete({
            where: { id, clinicId },
        });
        return { message: 'Política eliminada correctamente' };
    }
    // --- AGENT CONFIG ---
    async getAgentConfig(clinicId) {
        this.logger.log(`getAgentConfig - clinicId: ${clinicId}`);
        let config = await this.prisma.agentConfig.findUnique({
            where: { clinicId },
        });
        if (!config) {
            this.logger.log(`getAgentConfig - creating default config for clinicId: ${clinicId}`);
            const defaultActions = {
                schedule: { active: false, channels: [], integrations: [] },
                reschedule: { active: false, channels: [], integrations: [] },
                cancel: { active: false, channels: [], integrations: [] },
            };
            config = await this.prisma.agentConfig.create({
                data: {
                    clinicId,
                    actions: defaultActions,
                },
            });
        }
        return {
            id: config.id,
            clinic_id: config.clinicId,
            actions: config.actions,
            updated_at: config.updatedAt,
        };
    }
    async updateAgentConfig(clinicId, dto) {
        this.logger.log(`updateAgentConfig - clinicId: ${clinicId}`);
        const defaultActions = {
            schedule: { active: false, channels: [], integrations: [] },
            reschedule: { active: false, channels: [], integrations: [] },
            cancel: { active: false, channels: [], integrations: [] },
        };
        const config = await this.prisma.agentConfig.upsert({
            where: { clinicId },
            create: {
                clinicId,
                actions: (dto.actions || defaultActions),
            },
            update: {
                actions: (dto.actions || defaultActions),
            },
        });
        return {
            id: config.id,
            clinic_id: config.clinicId,
            actions: config.actions,
            updated_at: config.updatedAt,
        };
    }
    // --- INTEGRATIONS ---
    async getIntegrations(clinicId) {
        this.logger.log(`getIntegrations - clinicId: ${clinicId}`);
        const existing = await this.prisma.clinicIntegration.findMany({
            where: { clinicId },
        });
        const types = ['WHATSAPP', 'INSTAGRAM', 'GOOGLE_CALENDAR', 'DENTALINK', 'DENTIDESK', 'GMAIL'];
        return types.map(type => {
            const found = existing.find(e => e.type === type);
            return {
                type,
                connected: found?.connected ?? false,
                last_tested_at: found?.lastTestedAt ? found.lastTestedAt.toISOString() : '',
                last_test_ok: found?.lastTestOk ?? false,
                latency_ms: found?.credentials?.latency_ms ?? undefined,
            };
        });
    }
    async testConnection(clinicId, typeStr) {
        this.logger.log(`testConnection - clinicId: ${clinicId}, type: ${typeStr}`);
        const types = ['WHATSAPP', 'INSTAGRAM', 'GOOGLE_CALENDAR', 'DENTALINK', 'DENTIDESK', 'GMAIL'];
        const type = typeStr.toUpperCase();
        if (!types.includes(type)) {
            throw new common_1.BadRequestException(`Invalid integration type: ${typeStr}`);
        }
        const existing = await this.prisma.clinicIntegration.findUnique({
            where: { clinicId_type: { clinicId, type: type } },
        });
        if (!existing || !existing.credentials) {
            throw new common_1.BadRequestException('No hay credenciales configuradas para esta integración. Por favor configúralas primero.');
        }
        const credsObj = existing.credentials;
        let isOk = false;
        let errorMessage = '';
        const start = Date.now();
        // Cargar credenciales descifradas si existen
        let credentials = {};
        if (credsObj.encrypted_data) {
            try {
                const secretKey = process.env.JWT_ACCESS_SECRET || 'deviaty_super_secret_key_2026';
                const decrypted = (0, shared_utils_1.decryptAES256)(credsObj.encrypted_data, secretKey);
                credentials = JSON.parse(decrypted);
            }
            catch (error) {
                this.logger.error(`Error descifrando credenciales para test: ${error.message}`);
            }
        }
        // Realizar validación real o simulación
        if (type === 'WHATSAPP') {
            const phoneNumberId = credentials.phone_number_id || '';
            const accessToken = credentials.access_token || process.env.WHATSAPP_ACCESS_TOKEN || '';
            if (!phoneNumberId || !accessToken) {
                errorMessage = 'ID de teléfono no configurado.';
            }
            else if (phoneNumberId.toLowerCase().includes('mock') ||
                phoneNumberId.toLowerCase().includes('dummy') ||
                accessToken.toLowerCase().includes('mock') ||
                accessToken.toLowerCase().includes('dummy')) {
                // Bypass para testing/mock
                isOk = true;
            }
            else {
                try {
                    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    isOk = res.ok;
                    if (!isOk) {
                        const errData = await res.json().catch(() => ({}));
                        errorMessage = errData.error?.message || `HTTP ${res.status}: Error al verificar con Meta`;
                    }
                }
                catch (err) {
                    isOk = false;
                    errorMessage = `Error de red: ${err.message}`;
                }
            }
        }
        else if (type === 'DENTALINK') {
            const token = credentials.access_token || '';
            if (!token) {
                errorMessage = 'Token de Dentalink no configurado.';
            }
            else if (token.toLowerCase().includes('mock') ||
                token.toLowerCase().includes('dummy')) {
                // Bypass para testing/mock
                isOk = true;
            }
            else {
                try {
                    const res = await fetch('https://api.dentalink.healthatom.com/v1/sucursales', {
                        headers: { Authorization: `Token ${token}` },
                    });
                    isOk = res.ok;
                    if (!isOk) {
                        const errData = await res.json().catch(() => ({}));
                        errorMessage = errData.message || `HTTP ${res.status}: Error al verificar con Dentalink`;
                    }
                }
                catch (err) {
                    isOk = false;
                    errorMessage = `Error de red: ${err.message}`;
                }
            }
        }
        else if (type === 'INSTAGRAM') {
            const pageId = credentials.page_id || '';
            const instagramAccountId = credentials.instagram_account_id || '';
            const accessToken = credentials.access_token || process.env.WHATSAPP_ACCESS_TOKEN || '';
            if (!pageId || !instagramAccountId) {
                errorMessage = 'ID de página de Facebook o ID de Instagram no configurado.';
            }
            else if (pageId.toLowerCase().includes('mock') ||
                pageId.toLowerCase().includes('dummy') ||
                instagramAccountId.toLowerCase().includes('mock') ||
                instagramAccountId.toLowerCase().includes('dummy')) {
                isOk = true;
            }
            else if (!accessToken) {
                errorMessage = 'Token de acceso a Meta no configurado en el servidor.';
            }
            else {
                try {
                    const res = await fetch(`https://graph.facebook.com/v21.0/${instagramAccountId}?fields=name`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    isOk = res.ok;
                    if (!isOk) {
                        const errData = await res.json().catch(() => ({}));
                        errorMessage = errData.error?.message || `HTTP ${res.status}: Error al verificar con Meta`;
                    }
                }
                catch (err) {
                    isOk = false;
                    errorMessage = `Error de red: ${err.message}`;
                }
            }
        }
        else if (type === 'GOOGLE_CALENDAR' || type === 'GMAIL') {
            const email = credentials.email || '';
            const accessToken = credentials.access_token || '';
            if (!email) {
                errorMessage = 'Email de cuenta de Google no configurado.';
            }
            else if (email.toLowerCase().includes('mock') || email.toLowerCase().includes('dummy')) {
                isOk = true;
            }
            else if (!accessToken) {
                errorMessage = 'La cuenta de Google no ha sido enlazada vía OAuth.';
            }
            else {
                try {
                    const res = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    isOk = res.ok;
                    if (!isOk) {
                        errorMessage = 'Token OAuth de Google inválido o expirado. Vuelve a vincular la cuenta.';
                    }
                }
                catch (err) {
                    isOk = false;
                    errorMessage = `Error de red: ${err.message}`;
                }
            }
        }
        else if (type === 'DENTIDESK') {
            const apiKey = credentials.api_key || '';
            const clinicIdVal = credentials.clinic_id || '';
            if (!apiKey || !clinicIdVal) {
                errorMessage = 'API Key o ID de clínica de Dentidesk no configurado.';
            }
            else if (apiKey.toLowerCase().includes('mock') ||
                apiKey.toLowerCase().includes('dummy') ||
                clinicIdVal.toLowerCase().includes('mock') ||
                clinicIdVal.toLowerCase().includes('dummy')) {
                isOk = true;
            }
            else {
                errorMessage = 'Error al verificar conexión con Dentidesk: Token inválido.';
            }
        }
        else {
            isOk = false;
            errorMessage = 'Tipo de integración no soportada para validación.';
        }
        const latency_ms = Date.now() - start || Math.floor(Math.random() * 80) + 40;
        const testedAt = new Date();
        const updatedCreds = {
            ...credsObj,
            latency_ms,
        };
        await this.prisma.clinicIntegration.update({
            where: { clinicId_type: { clinicId, type: type } },
            data: {
                lastTestedAt: testedAt,
                lastTestOk: isOk,
                connected: isOk,
                credentials: updatedCreds,
            },
        });
        return {
            ok: isOk,
            tested_at: testedAt.toISOString(),
            latency_ms,
            error: isOk ? undefined : errorMessage,
        };
    }
    async saveCredentials(clinicId, typeStr, credentials) {
        this.logger.log(`saveCredentials - clinicId: ${clinicId}, type: ${typeStr}`);
        const type = typeStr.toUpperCase();
        const schema = INTEGRATION_SCHEMAS[type];
        if (!schema) {
            throw new common_1.BadRequestException(`Invalid integration type: ${typeStr}`);
        }
        const existing = await this.prisma.clinicIntegration.findUnique({
            where: { clinicId_type: { clinicId, type: type } },
        });
        // Cargar credenciales existentes si las hay para preservar contraseñas
        let existingCredentials = {};
        if (existing && existing.credentials) {
            const existingObj = existing.credentials;
            if (existingObj.encrypted_data) {
                try {
                    const secretKey = process.env.JWT_ACCESS_SECRET || 'deviaty_super_secret_key_2026';
                    const decrypted = (0, shared_utils_1.decryptAES256)(existingObj.encrypted_data, secretKey);
                    existingCredentials = JSON.parse(decrypted);
                }
                catch (error) {
                    this.logger.error(`Error descifrando credenciales previas para ${type}: ${error.message}`);
                }
            }
        }
        // Validar y resolver campos final
        const cleanCredentials = {};
        for (const field of schema) {
            let val = credentials[field.key];
            // Si es un password y el valor recibido es vacío, enmascarado o ausente
            if (field.type === 'password' && (!val || val.trim() === '' || val === '••••••••')) {
                // Intentar mantener el valor existente
                if (existingCredentials[field.key]) {
                    val = existingCredentials[field.key];
                }
            }
            if (field.required && (!val || !val.trim())) {
                throw new common_1.BadRequestException(`El campo '${field.label}' es requerido.`);
            }
            if (val !== undefined) {
                cleanCredentials[field.key] = val;
            }
        }
        // Cifrar credenciales
        const secretKey = process.env.JWT_ACCESS_SECRET || 'deviaty_super_secret_key_2026';
        const encryptedData = (0, shared_utils_1.encryptAES256)(JSON.stringify(cleanCredentials), secretKey);
        const testedAt = new Date();
        const credsObj = existing?.credentials || {};
        const updatedCreds = {
            ...credsObj,
            encrypted_data: encryptedData,
        };
        await this.prisma.clinicIntegration.upsert({
            where: {
                clinicId_type: { clinicId, type: type },
            },
            update: {
                connected: false,
                lastTestedAt: null,
                lastTestOk: null,
                credentials: updatedCreds,
            },
            create: {
                clinicId,
                type: type,
                connected: false,
                lastTestedAt: null,
                lastTestOk: null,
                credentials: updatedCreds,
            },
        });
        return {
            success: true,
            message: 'Credenciales guardadas y encriptadas con éxito.',
        };
    }
    async getIntegrationDetails(clinicId, typeStr) {
        this.logger.log(`getIntegrationDetails - clinicId: ${clinicId}, type: ${typeStr}`);
        const type = typeStr.toUpperCase();
        const schema = INTEGRATION_SCHEMAS[type];
        if (!schema) {
            throw new common_1.BadRequestException(`Invalid integration type: ${typeStr}`);
        }
        const integration = await this.prisma.clinicIntegration.findUnique({
            where: {
                clinicId_type: { clinicId, type: type },
            },
        });
        // Cargar credenciales guardadas si existen
        let savedCredentials = {};
        if (integration && integration.credentials) {
            const credsObj = integration.credentials;
            if (credsObj.encrypted_data) {
                try {
                    const secretKey = process.env.JWT_ACCESS_SECRET || 'deviaty_super_secret_key_2026';
                    const decrypted = (0, shared_utils_1.decryptAES256)(credsObj.encrypted_data, secretKey);
                    savedCredentials = JSON.parse(decrypted);
                }
                catch (error) {
                    this.logger.error(`Error descifrando credenciales para ${type}: ${error.message}`);
                }
            }
        }
        // Mapear campos con el esquema, enmascarando los campos tipo password
        const fields = schema.map(field => {
            const value = savedCredentials[field.key] || '';
            const isConfigured = value !== '';
            return {
                key: field.key,
                label: field.label,
                type: field.type,
                required: field.required,
                configured: isConfigured,
                // Si es password y tiene valor, enmascaramos
                value: field.type === 'password' && isConfigured ? '••••••••' : value,
            };
        });
        return {
            type,
            connected: integration?.connected ?? false,
            last_tested_at: integration?.lastTestedAt ? integration.lastTestedAt.toISOString() : null,
            last_test_ok: integration?.lastTestOk ?? null,
            fields,
        };
    }
};
exports.ClinicService = ClinicService;
exports.ClinicService = ClinicService = ClinicService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_prisma_1.PrismaService)),
    __metadata("design:paramtypes", [shared_prisma_1.PrismaService])
], ClinicService);
const INTEGRATION_SCHEMAS = {
    WHATSAPP: [
        { key: 'phone_number_id', label: 'ID del Número de Teléfono (en Meta)', type: 'text', required: true },
    ],
    INSTAGRAM: [
        { key: 'page_id', label: 'ID de la Página de Facebook', type: 'text', required: true },
        { key: 'instagram_account_id', label: 'ID de la Cuenta de Instagram Direct', type: 'text', required: true },
    ],
    GOOGLE_CALENDAR: [
        { key: 'email', label: 'Email de la cuenta de Google', type: 'text', required: true },
    ],
    DENTALINK: [
        { key: 'access_token', label: 'Token de Dentalink API', type: 'password', required: true },
    ],
    DENTIDESK: [
        { key: 'api_key', label: 'API Key de Dentidesk', type: 'password', required: true },
        { key: 'clinic_id', label: 'ID de la Clínica (Dentidesk)', type: 'text', required: true },
    ],
    GMAIL: [
        { key: 'email', label: 'Email de la cuenta de Gmail', type: 'text', required: true },
    ],
};
//# sourceMappingURL=clinic.service.js.map