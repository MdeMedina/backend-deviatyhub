import { SetMetadata } from '@nestjs/common';

export const AUDIT_ENTITY_KEY = 'audit_entity';

/**
 * Decorador para marcar un método como auditable.
 * @param entity Nombre de la entidad que se está afectando (ej: 'user', 'role').
 */
export const Auditable = (entity: string) => SetMetadata(AUDIT_ENTITY_KEY, entity);
