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
const proxy_config_1 = require("./proxy.config");
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
                const targetUrl = `${rule.target}${req.url.replace(rule.prefix, '')}`;
                return reply.from(targetUrl, {
                    onResponse: (request, reply, res) => {
                        // Manejar errores de conexión (ej: microservicio caído)
                        if (res.statusCode >= 500) {
                            // Dejar pasar si el microservicio respondió con 50x
                            reply.send(res);
                        }
                        else {
                            reply.send(res);
                        }
                    },
                    onError: (reply, error) => {
                        console.error(`[Proxy Error] ${rule.prefix} -> ${rule.target}: ${error.message}`);
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