import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from './entities/tournament.entity';
import { TournamentParticipant } from './entities/tournament-participant.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament) private tournamentRepo: Repository<Tournament>,
    @InjectRepository(TournamentParticipant) private participantRepo: Repository<TournamentParticipant>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async list() {
    return this.tournamentRepo.find({ order: { startsAt: 'ASC' } });
  }

  async register(tournamentId: number, userId: number) {
    const tournament = await this.tournamentRepo.findOne({ where: { id: tournamentId } });
    if (!tournament) throw new BadRequestException('Tournament not found');
    if (tournament.status !== 'upcoming') throw new BadRequestException('Registration closed');

    const count = await this.participantRepo.count({ where: { tournamentId } });
    if (count >= tournament.maxParticipants) throw new BadRequestException('Tournament full');

    const existing = await this.participantRepo.findOne({ where: { tournamentId, userId } });
    if (existing) throw new BadRequestException('Already registered');

    if (tournament.entryFee > 0) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (user.coins < tournament.entryFee) throw new BadRequestException('Insufficient coins');
      user.coins -= tournament.entryFee;
      await this.userRepo.save(user);
    }

    return this.participantRepo.save(
      this.participantRepo.create({ tournamentId, userId }),
    );
  }

  async getParticipants(tournamentId: number) {
    return this.participantRepo.find({ where: { tournamentId } });
  }
}
