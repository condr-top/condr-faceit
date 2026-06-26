import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Friendship } from './entities/friendship.entity';
import { MatchPlayer } from '../matches/entities/match-player.entity';
import { Match } from '../matches/entities/match.entity';
import { EloHistory } from './entities/elo-history.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { InviteModule } from '../invite/invite.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Friendship, MatchPlayer, Match, EloHistory]), GatewayModule, InviteModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
