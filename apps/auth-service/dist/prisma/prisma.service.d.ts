import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@deviaty/shared-prisma';
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
//# sourceMappingURL=prisma.service.d.ts.map