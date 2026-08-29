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
    logger = new common_1.Logger('HttpExceptionFilter');
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
        }
        else if (exception && typeof exception.getStatus === 'function') {
            status = exception.getStatus();
        }
        else if (exception && typeof exception.status === 'number') {
            status = exception.status;
        }
        else if (exception && typeof exception.statusCode === 'number') {
            status = exception.statusCode;
        }
        let exceptionResponse = null;
        if (exception instanceof common_1.HttpException) {
            exceptionResponse = exception.getResponse();
        }
        else if (exception && typeof exception.getResponse === 'function') {
            exceptionResponse = exception.getResponse();
        }
        else if (exception && exception.response) {
            exceptionResponse = exception.response;
        }
        let code = 'INTERNAL_ERROR';
        let message = exception?.message || 'Internal server error';
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
        // Si la respuesta de Nest ya tiene un objeto (ej: de class-validator)
        if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
            const respObj = exceptionResponse;
            if (respObj.message) {
                message = Array.isArray(respObj.message)
                    ? respObj.message.join(', ')
                    : respObj.message;
            }
            if (respObj.code)
                code = respObj.code;
        }
        // Loguear el error con detalles contextuales
        const path = request?.url || '';
        const method = request?.method || '';
        if (status >= 500) {
            this.logger.error(`💥 [${method}] ${path} Status: ${status} - Error: ${exception.message || exception}`, exception.stack);
        }
        else {
            this.logger.warn(`⚠️ [${method}] ${path} Status: ${status} - Code: ${code} - Msg: ${message}`);
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