import {
  Controller,
  Get,
  Patch,
  Put,
  Body,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import {
  Auditable,
  CurrentClinicId,
} from '@deviaty/shared-nestjs';
import { ClinicService } from './clinic.service';

const AGENT_MODES = ['AUTONOMOUS', 'SUPERVISED', 'PAUSED'] as const;
type AgentModeDto = (typeof AGENT_MODES)[number];

interface UpdateAgentConfigDto {
  actions?: any;
  mode?: AgentModeDto;
}

/** Un modo desconocido reventaría en Prisma con un error opaco. */
function assertValidMode(mode?: string) {
  if (mode !== undefined && !AGENT_MODES.includes(mode as AgentModeDto)) {
    throw new BadRequestException(
      `Modo de agente inválido: "${mode}". Valores admitidos: ${AGENT_MODES.join(', ')}.`
    );
  }
}

@Controller('agent-config')
export class AgentConfigController {
  constructor(
    @Inject(ClinicService)
    private readonly clinicService: ClinicService
  ) {}

  @Get()
  async getAgentConfig(@CurrentClinicId() clinicId: string) {
    return this.clinicService.getAgentConfig(clinicId);
  }

  @Patch()
  @Auditable('agentConfig')
  async updateAgentConfig(
    @CurrentClinicId() clinicId: string,
    @Body() dto: UpdateAgentConfigDto
  ) {
    assertValidMode(dto.mode);
    return this.clinicService.updateAgentConfig(clinicId, dto);
  }

  @Put()
  @Auditable('agentConfig')
  async updateAgentConfigPut(
    @CurrentClinicId() clinicId: string,
    @Body() dto: UpdateAgentConfigDto
  ) {
    assertValidMode(dto.mode);
    return this.clinicService.updateAgentConfig(clinicId, dto);
  }
}
