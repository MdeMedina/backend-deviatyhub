import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

// Public Decorator
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Auditable Decorator
export const AUDIT_ENTITY_KEY = 'auditable_entity';
export const Auditable = (entity: string) => SetMetadata(AUDIT_ENTITY_KEY, entity);

// User ID Decorator (Helper for controllers)
export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['x-user-id'];
  },
);

// Clinic ID Decorator (Helper for controllers)
export const CurrentClinicId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['x-clinic-id'];
  },
);
