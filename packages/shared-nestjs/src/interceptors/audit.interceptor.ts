import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '@deviaty/shared-prisma';
import { AUDIT_ENTITY_KEY } from '../decorators/index';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly sensitiveKeys = [
    'passwordHash',
    'tokenHash',
    'password',
    'refreshToken',
  ];

  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const entity = this.reflector.get<string>(
      AUDIT_ENTITY_KEY,
      context.getHandler(),
    );

    // Si no tiene el decorador, ignorar
    if (!entity) return next.handle();

    const request = context.switchToHttp().getRequest();
    const { method, params, user } = request;

    // Solo auditamos mutaciones (POST, PATCH, PUT, DELETE)
    if (method === 'GET') return next.handle();

    const entityId = params.id;
    let beforeData: any = null;

    // Intentar capturar estado previo para UPDATE/DELETE
    if (
      entityId &&
      (method === 'PATCH' || method === 'PUT' || method === 'DELETE')
    ) {
      try {
        beforeData = await (this.prisma as any)[entity].findUnique({
          where: { id: entityId },
        });
      } catch (e) {
        console.warn(
          `[Audit] No se pudo obtener estado previo para ${entity}:${entityId}`,
        );
      }
    }

    return next.handle().pipe(
      tap(async (afterData) => {
        try {
          // Extraer clinicId y userId del request (poblado por JwtAuthGuard en Gateway o Auth)
          // Nota: El Gateway pasa x-clinic-id y x-user-id en los headers
          const clinicId = user?.clinicId || request.headers['x-clinic-id'];
          const userId = user?.userId || request.headers['x-user-id'];

          if (!clinicId || !userId) return;

          // Sanitizar datos
          const sanitizedBefore = this.sanitize(beforeData);
          const sanitizedAfter = this.sanitize(afterData);

          // Crear registro de auditoría
          await this.prisma.auditLog.create({
            data: {
              clinicId,
              userId,
              entity,
              entityId:
                entityId ||
                afterData?.id ||
                '00000000-0000-0000-0000-000000000000',
              action: method,
              changes: {
                before: sanitizedBefore || {},
                after: sanitizedAfter || {},
              },
            },
          });
        } catch (error) {
          console.error('[Audit] Error persistiendo log de auditoría:', error);
        }
      }),
    );
  }

  private sanitize(data: any): any {
    if (!data || typeof data !== 'object') return data;
    const sanitized = { ...data };
    for (const key of this.sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }
}
