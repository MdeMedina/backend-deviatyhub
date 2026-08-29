import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    if (exception instanceof HttpException) {
      status = exception.getStatus();
    } else if (exception && typeof exception.getStatus === 'function') {
      status = exception.getStatus();
    } else if (exception && typeof exception.status === 'number') {
      status = exception.status;
    } else if (exception && typeof exception.statusCode === 'number') {
      status = exception.statusCode;
    }

    let exceptionResponse = null;
    if (exception instanceof HttpException) {
      exceptionResponse = exception.getResponse();
    } else if (exception && typeof exception.getResponse === 'function') {
      exceptionResponse = exception.getResponse();
    } else if (exception && exception.response) {
      exceptionResponse = exception.response;
    }

    let code = 'INTERNAL_ERROR';
    let message = exception?.message || 'Internal server error';

    // Mapeo dinámico de códigos según API Reference
    if (status === HttpStatus.BAD_REQUEST) code = 'VALIDATION_ERROR';
    if (status === HttpStatus.UNAUTHORIZED) code = 'UNAUTHORIZED';
    if (status === HttpStatus.FORBIDDEN) code = 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) code = 'NOT_FOUND';
    if (status === HttpStatus.CONFLICT) code = 'CONFLICT';

    // Si la respuesta de Nest ya tiene un objeto (ej: de class-validator)
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const respObj = exceptionResponse as any;
      if (respObj.message) {
        message = Array.isArray(respObj.message)
          ? respObj.message.join(', ')
          : respObj.message;
      }
      if (respObj.code) code = respObj.code;
    }

    // Loguear el error con detalles contextuales
    const path = request?.url || '';
    const method = request?.method || '';
    if (status >= 500) {
      this.logger.error(
        `💥 [${method}] ${path} Status: ${status} - Error: ${exception.message || exception}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `⚠️ [${method}] ${path} Status: ${status} - Code: ${code} - Msg: ${message}`
      );
    }

    response.status(status).send({
      success: false,
      error: {
        code,
        message,
      },
    });
  }
}

