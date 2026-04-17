"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.paginatedResponse = paginatedResponse;
/**
 * Genera una respuesta exitosa estandarizada
 */
function successResponse(data, meta) {
    return {
        success: true,
        data,
        meta
    };
}
/**
 * Genera una respuesta de error estandarizada
 */
function errorResponse(code, message, details) {
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
function paginatedResponse(items, total, page, limit) {
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
//# sourceMappingURL=response.util.js.map