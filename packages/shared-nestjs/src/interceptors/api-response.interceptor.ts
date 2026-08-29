import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
}

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  private readonly logger = new Logger('RequestLogger');

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    
    // Si no es una petición HTTP normal (ej: websocket), omitir
    if (!req || !req.method) {
      return next.handle().pipe(
        map((data) => ({
          success: true,
          data: data || {},
        })),
      );
    }

    const { method, url } = req;
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    const startTime = Date.now();

    this.logger.log(`📥 [${method}] ${url} - Handled by ${controller}.${handler}`);

    return next.handle().pipe(
      map((data) => {
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
      }),
    );
  }
}

