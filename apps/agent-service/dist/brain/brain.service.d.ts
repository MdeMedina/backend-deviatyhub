import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@deviaty/shared-prisma';
export declare class BrainService {
    private readonly configService;
    private readonly prisma;
    private readonly logger;
    private model;
    constructor(configService: ConfigService, prisma: PrismaService);
    processMessage(params: {
        clinicId: string;
        contact: any;
        history: any[];
        userInput: string;
        currentStep: string;
    }): Promise<{
        text: string;
        nextStep?: string;
    }>;
}
//# sourceMappingURL=brain.service.d.ts.map