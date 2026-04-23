"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const logger = new common_1.Logger('Bootstrap');
    logger.log('🤖 Agent Service (AmalIA) worker started and listening to "messages" queue');
    // Mantener el proceso vivo para el worker de BullMQ
    // No necesitamos un servidor HTTP público (Gateway rutea pero este es un worker)
}
bootstrap();
//# sourceMappingURL=main.js.map