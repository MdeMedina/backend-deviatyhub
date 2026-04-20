import { AgendaService } from './agenda.service';
export declare class AgendaController {
    private readonly agendaService;
    constructor(agendaService: AgendaService);
    getSlots(clinicId: string, date: string, treatmentId?: string, doctorId?: string): Promise<{
        time: string;
        available: boolean;
    }[]>;
}
//# sourceMappingURL=agenda.controller.d.ts.map