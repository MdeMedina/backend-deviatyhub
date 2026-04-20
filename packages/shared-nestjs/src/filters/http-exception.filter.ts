import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let code = 'INTERNAL_ERROR';
    let message = exception.message || 'Internal server error';

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
          ? respObj.message[0]
          : respObj.message;
      }
      if (respObj.code) code = respObj.code;
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
