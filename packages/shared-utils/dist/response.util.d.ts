import { IApiResponse, IPaginatedResponse } from '@deviaty/shared-types';
/**
 * Genera una respuesta exitosa estandarizada
 */
export declare function successResponse<T>(data: T, meta?: any): IApiResponse<T>;
/**
 * Genera una respuesta de error estandarizada
 */
export declare function errorResponse(code: string, message: string, details?: any): IApiResponse<null>;
/**
 * Genera una respuesta paginada estandarizada
 */
export declare function paginatedResponse<T>(items: T[], total: number, page: number, limit: number): IApiResponse<IPaginatedResponse<T>>;
//# sourceMappingURL=response.util.d.ts.map