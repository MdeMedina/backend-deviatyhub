import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@deviaty/shared-prisma';
import { BrainService } from '../brain/brain.service';
import { EventBus } from '@deviaty/shared-events';
export declare class AgentProcessor extends WorkerHost {
    private readonly prisma;
    private readonly brain;
    private readonly eventBus;
    private readonly logger;
    constructor(prisma: PrismaService, brain: BrainService, eventBus: EventBus);
    process(job: Job<any, any, string>): Promise<any>;
}
//# sourceMappingURL=agent.processor.d.ts.map