import { MetricsService } from './metrics.service';
export declare class MetricsController {
    private readonly metricsService;
    constructor(metricsService: MetricsService);
    getSummary(clinicId: string, period: string): Promise<{
        period: string;
        from: Date;
        to: Date;
        conversations_attended: number;
        containment_rate: number;
        human_takeovers: number;
        appointments_scheduled: number;
        appointments_rescheduled: number;
        appointments_cancelled: number;
        intentions_distribution: {
            intention: string | null;
            count: number;
            percentage: number;
        }[];
        interactions_by_hour: {
            hour: number;
            count: number;
        }[];
    }>;
}
//# sourceMappingURL=metrics.controller.d.ts.map