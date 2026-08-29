"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponseInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
let ApiResponseInterceptor = class ApiResponseInterceptor {
    logger = new common_1.Logger('RequestLogger');
    intercept(context, next) {
        const ctx = context.switchToHttp();
        const req = ctx.getRequest();
        // Si no es una petición HTTP normal (ej: websocket), omitir
        if (!req || !req.method) {
            return next.handle().pipe((0, operators_1.map)((data) => ({
                success: true,
                data: data || {},
            })));
        }
        const { method, url } = req;
        const controller = context.getClass().name;
        const handler = context.getHandler().name;
        const startTime = Date.now();
        this.logger.log(`📥 [${method}] ${url} - Handled by ${controller}.${handler}`);
        return next.handle().pipe((0, operators_1.map)((data) => {
            const duration = Date.now() - startTime;
            this.logger.log(`📤 [${method}] ${url} - Success (${duration}ms)`);
            // Mantener la estructura del payload pero extraer meta si viniera en la data
            let finalData = data;
            let meta = undefined;
            if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
                finalData = data.data;
                meta = data.meta;
            }
            return {
                success: true,
                data: finalData || {},
                ...(meta ? { meta } : {}),
            };
        }));
    }
};
exports.ApiResponseInterceptor = ApiResponseInterceptor;
exports.ApiResponseInterceptor = ApiResponseInterceptor = __decorate([
    (0, common_1.Injectable)()
], ApiResponseInterceptor);
//# sourceMappingURL=api-response.interceptor.js.map