import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@deviaty/shared-prisma';
import { BrainService } from '../brain/brain.service';
export declare class AgentProcessor extends WorkerHost {
    private readonly prisma;
    private readonly brain;
    private readonly logger;
    constructor(prisma: PrismaService, brain: BrainService);
    process(job: Job<any, any, string>): Promise<any>;
}
//# sourceMappingURL=agent.processor.d.ts.map