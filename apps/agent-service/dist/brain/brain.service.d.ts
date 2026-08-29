import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@deviaty/shared-prisma';
import { IntentionClassifier } from './intention.classifier';
import { StateManager } from './state.manager';
import { AvailabilityTool } from '../tools/availability.tool';
import { HumanTool } from '../tools/human.tool';
import { AppointmentActionsTool } from '../tools/appointment-actions.tool';
export declare class BrainService {
    private readonly configService;
    private readonly prisma;
    private readonly classifier;
    private readonly stateManager;
    private readonly availabilityTool;
    private readonly humanTool;
    private readonly actionsTool;
    private readonly logger;
    private model;
    constructor(configService: ConfigService, prisma: PrismaService, classifier: IntentionClassifier, stateManager: StateManager, availabilityTool: AvailabilityTool, humanTool: HumanTool, actionsTool: AppointmentActionsTool);
    processMessage(params: {
        conversationId: string;
        clinicId: string;
        contact: any;
        history: any[];
        userInput: string;
        currentStep: string;
        metadata: any;
    }): Promise<{
        text: string;
        nextStep?: string;
    }>;
}
//# sourceMappingURL=brain.service.d.ts.map