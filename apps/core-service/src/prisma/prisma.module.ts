import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@deviaty/shared-prisma';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
