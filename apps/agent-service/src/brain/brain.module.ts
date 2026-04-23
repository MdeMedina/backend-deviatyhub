import { Module } from '@nestjs/common';
import { BrainService } from './brain.service';
import { IntentionClassifier } from './intention.classifier';
import { StateManager } from './state.manager';
import { AvailabilityTool } from '../tools/availability.tool';
import { HumanTool } from '../tools/human.tool';

@Module({
  providers: [
    BrainService, 
    IntentionClassifier, 
    StateManager,
    AvailabilityTool,
    HumanTool
  ],
  exports: [BrainService],
})
export class BrainModule {}
