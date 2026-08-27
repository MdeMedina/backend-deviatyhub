import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { FastifyInstance } from 'fastify';
import fastifyReplyFrom from '@fastify/reply-from';
import { verifyJWT } from '@deviaty/shared-utils';
import { PROXY_CONFIG } from './proxy.config';

const PUBLIC_PATHS = new Set([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/set-password',
]);

@Module({})
export class ProxyModule implements OnModuleInit {
  constructor(
    @Inject(HttpAdapterHost)
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  async onModuleInit() {
    const httpAdapter = this.adapterHost.httpAdapter;
    const fastify: FastifyInstance = httpAdapter.getInstance();

    // Registrar el plugin de Proxy
    await fastify.register(fastifyReplyFrom);

    // Registrar reglas de ruteo
    for (const rule of PROXY_CONFIG) {
      const handler = (req: any, reply: any) => {
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

        let clinicId: string | undefined;
        let userId: string | undefined;
        let isSuperadmin = 'false';

        if (jwtToken) {
          try {
            const secret = process.env.JWT_ACCESS_SECRET;
            if (!secret) throw new Error('JWT_ACCESS_SECRET no está configurado');
            const payload = verifyJWT<any>(jwtToken, secret);
            clinicId = payload.clinicId;
            userId = payload.userId;
            isSuperadmin = String(payload.role === 'SUPERADMIN');
          } catch (error: any) {
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
        } else if (!isPublic) {
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

        return (reply as any).from(targetUrl, {
          rewriteRequestHeaders: (originalReq: any, headers: any) => {
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
          onResponse: (request: any, reply: any, res: any) => {
            const duration = Date.now() - startTime;
            console.log(`[Proxy] 📤 [${req.method}] ${req.url} -> Status: ${reply.statusCode} (${duration}ms)`);
            reply.send(res);
          },
          onError: (reply: any, error: any) => {
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
}

