import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { DailyReward } from './entities/daily-reward.entity';
import { Friendship } from './entities/friendship.entity';
import { MatchPlayer } from '../matches/entities/match-player.entity';
import { Match } from '../matches/entities/match.entity';
import { EloHistory } from './entities/elo-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, DailyReward, Friendship, MatchPlayer, Match, EloHistory])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
