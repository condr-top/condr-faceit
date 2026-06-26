import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CplController } from './cpl.controller';
import { CplService } from './cpl.service';
import { Season } from './entities/season.entity';
import { CplWeekly } from './entities/cpl-weekly.entity';
import { CplStanding } from './entities/cpl-standing.entity';
import { User } from '../users/entities/user.entity';
import { Match } from '../matches/entities/match.entity';
import { MatchPlayer } from '../matches/entities/match-player.entity';
import { Notification } from '../notifications/entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Season, CplWeekly, CplStanding, User, Match, MatchPlayer, Notification])],
  controllers: [CplController],
  providers: [CplService],
  exports: [CplService],
})
export class CplModule {}
