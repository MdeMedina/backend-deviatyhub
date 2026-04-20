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
      fastify.all(`${rule.prefix}`, (req, reply) => {
        return (reply as any).from(`${rule.target}${req.url.replace(rule.prefix, '')}`);
      });

      fastify.all(`${rule.prefix}/*`, (req, reply) => {
        return (reply as any).from(`${rule.target}${req.url.replace(rule.prefix, '')}`);
      });
      
      console.log(`🔗 Proxy mapped: ${rule.prefix} -> ${rule.target}`);
    }
  }
}
