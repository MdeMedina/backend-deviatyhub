import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { PrismaService } from '@deviaty/shared-prisma';
export declare class AuditInterceptor implements NestInterceptor {
    private readonly reflector;
    private readonly prisma;
    private readonly sensitiveKeys;
    constructor(reflector: Reflector, prisma: PrismaService);
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>>;
    private sanitize;
}
//# sourceMappingURL=audit.interceptor.d.ts.map