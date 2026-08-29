"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        errorHttpStatusCode: 400,
    }));
    const logger = new common_1.Logger('Bootstrap');
    const port = process.env.PORT || 3003;
    await app.listen(port, '0.0.0.0');
    logger.log(`🤖 Agent Service (AmalIA) HTTP server is running on: http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map