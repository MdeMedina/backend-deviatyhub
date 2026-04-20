"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter());
    // Prefijo global /api tal como exige API Reference desde el Gateway
    // Nota: Aunque el Gateway lo añade, los microservicios deben ser consistentes
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        errorHttpStatusCode: 400,
    }));
    const port = process.env.PORT || 3002;
    await app.listen(port, '0.0.0.0');
    console.log(`🏥 Core Service is running on: http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map