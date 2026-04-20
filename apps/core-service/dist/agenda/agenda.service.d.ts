import { PrismaService } from '@deviaty/shared-prisma';
export declare class AgendaService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAvailableSlots(clinicId: string, date: string, treatmentId?: string, doctorId?: string): Promise<{
        time: string;
        available: boolean;
    }[]>;
}
//# sourceMappingURL=agenda.service.d.ts.map