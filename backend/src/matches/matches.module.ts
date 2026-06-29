import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { Match } from './entities/match.entity';
import { MatchPlayer } from './entities/match-player.entity';
import { MatchMessage } from './entities/match-message.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ClanMatch } from '../clans/entities/clan-match.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { DiscordModule } from '../discord/discord.module';
import { ClansModule } from '../clans/clans.module';
import { ClanQueueService } from './clan-queue.service';

@Module({
  imports: [TypeOrmModule.forFeature([Match, MatchPlayer, MatchMessage, User, Notification, ClanMatch]), GatewayModule, DiscordModule, ClansModule],
  controllers: [MatchesController],
  providers: [MatchesService, ClanQueueService],
  exports: [MatchesService, ClanQueueService],
})
export class MatchesModule {}
