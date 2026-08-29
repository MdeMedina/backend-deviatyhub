"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const reply_from_1 = __importDefault(require("@fastify/reply-from"));
const shared_utils_1 = require("@deviaty/shared-utils");
const proxy_config_1 = require("./proxy.config");
const PUBLIC_PATHS = new Set([
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/set-password',
]);
let ProxyModule = class ProxyModule {
    adapterHost;
    constructor(adapterHost) {
        this.adapterHost = adapterHost;
    }
    async onModuleInit() {
        const httpAdapter = this.adapterHost.httpAdapter;
        const fastify = httpAdapter.getInstance();
        // Registrar el plugin de Proxy
        await fastify.register(reply_from_1.default);
        // Registrar reglas de ruteo
        for (const rule of proxy_config_1.PROXY_CONFIG) {
            const handler = (req, reply) => {
                // Intercept CORS preflight requests
                if (req.method === 'OPTIONS') {
                    reply.status(204).send();
                    return;
                }
                // Normalizar la ruta para comparar con rutas públicas (remover barra final si existe)
                const urlPath = req.url.split('?')[0].replace(/\/$/, '');
                const isPublic = PUBLIC_PATHS.has(urlPath);
                const authHeader = req.headers.authorization;
                const [type, token] = authHeader?.split(' ') ?? [];
                const jwtToken = type === 'Bearer' ? token : undefined;
                let clinicId;
                let userId;
                let isSuperadmin = 'false';
                if (jwtToken) {
                    try {
                        // Se usa el secret configurado o el de desarrollo por defecto
                        const secret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
                        const payload = (0, shared_utils_1.verifyJWT)(jwtToken, secret);
                        clinicId = payload.clinicId;
                        userId = payload.userId;
                        isSuperadmin = String(payload.role === 'SUPERADMIN');
                    }
                    catch (error) {
                        if (!isPublic) {
                            console.warn(`[Proxy Auth] Token validation failed for ${urlPath}: ${error.message}`);
                            reply.status(401).send({
                                success: false,
                                error: {
                                    code: 'UNAUTHORIZED',
                                    message: 'Token inválido o expirado',
                                },
                            });
                            return;
                        }
                    }
                }
                else if (!isPublic) {
                    console.warn(`[Proxy Auth] Request blocked (missing token) for ${urlPath}`);
                    reply.status(401).send({
                        success: false,
                        error: {
                            code: 'UNAUTHORIZED',
                            message: 'Token no proporcionado',
                        },
                    });
                    return;
                }
                const startTime = Date.now();
                const targetUrl = `${rule.target}${req.url.replace(rule.prefix, '')}`;
                console.log(`[Proxy] 📥 [${req.method}] ${req.url} -> ${targetUrl}`);
                return reply.from(targetUrl, {
                    rewriteRequestHeaders: (originalReq, headers) => {
                        const newHeaders = { ...headers };
                        if (clinicId) {
                            newHeaders['x-clinic-id'] = clinicId;
                        }
                        if (userId) {
                            newHeaders['x-user-id'] = userId;
                        }
                        newHeaders['x-is-superadmin'] = isSuperadmin;
                        return newHeaders;
                    },
                    onResponse: (request, reply, res) => {
                        const duration = Date.now() - startTime;
                        console.log(`[Proxy] 📤 [${req.method}] ${req.url} -> Status: ${reply.statusCode} (${duration}ms)`);
                        reply.send(res);
                    },
                    onError: (reply, error) => {
                        const duration = Date.now() - startTime;
                        const errMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
                        console.error(`[Proxy Error] 💥 ${rule.prefix} -> ${rule.target} failed after ${duration}ms: ${errMsg}`);
                        // Retornar 502 Bad Gateway si el servicio no responde
                        reply.status(502).send({
                            success: false,
                            error: {
                                code: 'BAD_GATEWAY',
                                message: 'El servicio de destino no está disponible temporalmente.',
                            },
                        });
                    }
                });
            };
            fastify.all(`${rule.prefix}`, handler);
            fastify.all(`${rule.prefix}/*`, handler);
            console.log(`🔗 Proxy mapped: ${rule.prefix} -> ${rule.target}`);
        }
    }
};
exports.ProxyModule = ProxyModule;
exports.ProxyModule = ProxyModule = __decorate([
    (0, common_1.Module)({}),
    __param(0, (0, common_1.Inject)(core_1.HttpAdapterHost)),
    __metadata("design:paramtypes", [core_1.HttpAdapterHost])
], ProxyModule);
//# sourceMappingURL=proxy.module.js.map