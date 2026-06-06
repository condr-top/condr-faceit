import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { MatchesModule } from '../matches/matches.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [MatchesModule, GatewayModule],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
