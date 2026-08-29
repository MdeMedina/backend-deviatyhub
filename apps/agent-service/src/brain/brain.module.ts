import { Module } from '@nestjs/common';
import { BrainService } from './brain.service';
import { IntentionClassifier } from './intention.classifier';
import { StateManager } from './state.manager';
import { AvailabilityTool } from '../tools/availability.tool';
import { HumanTool } from '../tools/human.tool';
import { AppointmentActionsTool } from '../tools/appointment-actions.tool';
import { SharedEventsModule } from '@deviaty/shared-events';

@Module({
  imports: [SharedEventsModule],
  providers: [
    BrainService, 
    IntentionClassifier, 
    StateManager,
    AvailabilityTool,
    HumanTool,
    AppointmentActionsTool
  ],
  exports: [BrainService],
})
export class BrainModule {}
