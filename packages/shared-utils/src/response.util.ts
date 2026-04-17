import { IApiResponse, IPaginatedResponse } from '@deviaty/shared-types';

/**
 * Genera una respuesta exitosa estandarizada
 */
export function successResponse<T>(data: T, meta?: any): IApiResponse<T> {
  return {
    success: true,
    data,
    meta
  };
}

/**
 * Genera una respuesta de error estandarizada
 */
export function errorResponse(code: string, message: string, details?: any): IApiResponse<null> {
  return {
    success: false,
    error: {
      code,
      message,
      details
    }
  };
}

/**
 * Genera una respuesta paginada estandarizada
 */
export function paginatedResponse<T>(
  items: T[], 
  total: number, 
  page: number, 
  limit: number
): IApiResponse<IPaginatedResponse<T>> {
  const pages = Math.ceil(total / limit);
  return {
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      pages
    }
  };
}
