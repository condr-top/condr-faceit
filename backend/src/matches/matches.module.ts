import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { Match } from './entities/match.entity';
import { MatchPlayer } from './entities/match-player.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [TypeOrmModule.forFeature([Match, MatchPlayer, User, Notification]), GatewayModule, DiscordModule],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
