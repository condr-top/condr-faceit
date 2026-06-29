import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartyController } from './party.controller';
import { PartyService } from './party.service';
import { User } from '../users/entities/user.entity';
import { Friendship } from '../users/entities/friendship.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { MatchesModule } from '../matches/matches.module';
import { TelegramNotifyModule } from '../notifications/telegram-notify.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Friendship, Notification]),
    GatewayModule,
    MatchesModule,
    TelegramNotifyModule,
  ],
  controllers: [PartyController],
  providers: [PartyService],
  exports: [PartyService],
})
export class PartyModule {}
