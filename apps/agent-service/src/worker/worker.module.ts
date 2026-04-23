import { Module } from '@nestjs/common';
import { AgentProcessor } from './agent.processor';
import { BrainModule } from '../brain/brain.module';

@Module({
  imports: [BrainModule],
  providers: [AgentProcessor],
})
export class WorkerModule {}
