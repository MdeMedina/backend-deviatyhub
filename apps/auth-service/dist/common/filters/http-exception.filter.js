"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const status = exception instanceof common_1.HttpException
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const exceptionResponse = exception instanceof common_1.HttpException ? exception.getResponse() : null;
        let code = 'INTERNAL_ERROR';
        let message = exception.message || 'Internal server error';
        if (status === 500) {
            console.error('🔥 [DEBUG ERROR]:', exception);
        }
        // Mapeo dinámico de códigos según API Reference
        if (status === common_1.HttpStatus.BAD_REQUEST)
            code = 'VALIDATION_ERROR';
        if (status === common_1.HttpStatus.UNAUTHORIZED)
            code = 'UNAUTHORIZED';
        if (status === common_1.HttpStatus.FORBIDDEN)
            code = 'FORBIDDEN';
        if (status === common_1.HttpStatus.NOT_FOUND)
            code = 'NOT_FOUND';
        if (status === common_1.HttpStatus.CONFLICT)
            code = 'CONFLICT';
        // Si la respuesta de Nest ya tiene un código (ej: de class-validator)
        if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
            const respObj = exceptionResponse;
            if (respObj.message)
                message = Array.isArray(respObj.message) ? respObj.message[0] : respObj.message;
        }
        response.status(status).send({
            success: false,
            error: {
                code,
                message,
            },
        });
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map