import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { FastifyInstance } from 'fastify';
import fastifyReplyFrom from '@fastify/reply-from';
import { verifyJWT, moduloDeRuta } from '@deviaty/shared-utils';
import { PROXY_CONFIG } from './proxy.config';

// Rutas del backoffice: solo para superusuarios de la plataforma.
const PLATFORM_PREFIX = '/api/core/platform';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        let platformAdmin = false;
        let actuandoComoClinica = false;
        let modulos: Record<string, boolean> | undefined;

        if (jwtToken) {
          try {
            const secret = process.env.JWT_ACCESS_SECRET;
            if (!secret) throw new Error('JWT_ACCESS_SECRET no está configurado');
            const payload = verifyJWT<any>(jwtToken, secret);
            clinicId = payload.clinicId;
            userId = payload.userId;
            isSuperadmin = String(payload.role === 'SUPERADMIN');
            platformAdmin = payload.platformAdmin === true;
            modulos = payload.modules;

            // Un superusuario de la plataforma puede trabajar dentro de otra
            // clínica: el backoffice manda la clínica en x-act-as-clinic y
            // todos los servicios la ven como si fuera la suya. A cualquier
            // otro usuario se le ignora la cabecera.
            const actuarComo = String(req.headers['x-act-as-clinic'] || '').trim();
            if (platformAdmin && UUID.test(actuarComo)) {
              clinicId = actuarComo;
              actuandoComoClinica = true;
            }
            // Dentro de cualquier clínica, el equipo de la plataforma tiene
            // los permisos del dueño: está ahí para administrarla.
            if (platformAdmin) isSuperadmin = 'true';
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

        // El backoffice no existe para quien no es superusuario. Se corta aquí,
        // y core lo vuelve a comprobar por su cuenta.
        if (urlPath.startsWith(PLATFORM_PREFIX) && !platformAdmin) {
          reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Solo para el equipo de la plataforma' },
          });
          return;
        }

        // El equipo de la plataforma no tiene clínica propia: su cuenta vive en
        // una por exigencia del modelo de datos, pero no es la suya. Sin elegir
        // una, las rutas de clínica se rechazan en vez de servirle los datos de
        // esa (y dejarle cambiarlos sin darse cuenta). Quedan abiertas su sesión
        // y el backoffice.
        const rutaDeSesion = urlPath.startsWith('/api/auth/') && !urlPath.startsWith('/api/auth/users') && !urlPath.startsWith('/api/auth/roles');
        if (platformAdmin && !actuandoComoClinica && !rutaDeSesion && !urlPath.startsWith(PLATFORM_PREFIX)) {
          reply.status(409).send({
            success: false,
            error: { code: 'CLINIC_REQUIRED', message: 'Elige una clínica en el backoffice para trabajar en ella.' },
          });
          return;
        }

        // Rutas internas entre servicios: no se exponen por el gateway.
        if (urlPath.startsWith('/api/agent/internal')) {
          reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No encontrado' } });
          return;
        }

        // Módulo bloqueado por la plataforma para esta clínica. El menú ya no lo
        // muestra, pero el bloqueo de verdad es este. (El equipo de la
        // plataforma, dentro de una clínica, pasa: está para administrarla.)
        const modulo = moduloDeRuta(urlPath);
        if (modulo && !platformAdmin && modulos?.[modulo] === false) {
          reply.status(403).send({
            success: false,
            error: { code: 'MODULE_DISABLED', message: 'Esta sección no está habilitada para tu clínica.' },
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
            // Siempre se escribe, nunca se reenvía la que mande el cliente.
            newHeaders['x-platform-admin'] = String(platformAdmin);
            delete newHeaders['x-act-as-clinic'];
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

