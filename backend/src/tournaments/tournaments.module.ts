import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { Tournament } from './entities/tournament.entity';
import { TournamentParticipant } from './entities/tournament-participant.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tournament, TournamentParticipant, User])],
  controllers: [TournamentsController],
  providers: [TournamentsService],
})
export class TournamentsModule {}
