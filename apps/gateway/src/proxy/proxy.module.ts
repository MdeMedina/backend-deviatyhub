import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { FastifyInstance } from 'fastify';
import fastifyReplyFrom from '@fastify/reply-from';
import { PROXY_CONFIG } from './proxy.config';

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
        const targetUrl = `${rule.target}${req.url.replace(rule.prefix, '')}`;
        
        return (reply as any).from(targetUrl, {
          onResponse: (request: any, reply: any, res: any) => {
            // Manejar errores de conexión (ej: microservicio caído)
            if (res.statusCode >= 500) {
                // Dejar pasar si el microservicio respondió con 50x
                reply.send(res);
            } else {
                reply.send(res);
            }
          },
          onError: (reply: any, error: any) => {
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
}
