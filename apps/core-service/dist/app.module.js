"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const shared_nestjs_1 = require("../../../packages/shared-nestjs/dist");
const prisma_module_1 = require("./prisma/prisma.module");
const clinic_module_1 = require("./clinic/clinic.module");
const doctor_module_1 = require("./doctor/doctor.module");
const treatment_module_1 = require("./treatment/treatment.module");
const agenda_module_1 = require("./agenda/agenda.module");
const conversation_module_1 = require("./conversation/conversation.module");
const metrics_module_1 = require("./metrics/metrics.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            prisma_module_1.PrismaModule,
            clinic_module_1.ClinicModule,
            doctor_module_1.DoctorModule,
            treatment_module_1.TreatmentModule,
            agenda_module_1.AgendaModule,
            conversation_module_1.ConversationModule,
            metrics_module_1.MetricsModule,
        ],
        controllers: [],
        providers: [
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: shared_nestjs_1.AuditInterceptor,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: shared_nestjs_1.ApiResponseInterceptor,
            },
            {
                provide: core_1.APP_FILTER,
                useClass: shared_nestjs_1.HttpExceptionFilter,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map