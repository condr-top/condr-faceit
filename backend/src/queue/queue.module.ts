import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { MatchesModule } from '../matches/matches.module';
import { GatewayModule } from '../gateway/gateway.module';
import { TelegramNotifyModule } from '../notifications/telegram-notify.module';

@Module({
  imports: [MatchesModule, GatewayModule, TelegramNotifyModule],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
