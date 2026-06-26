import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class LeaderboardService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  // Simple in-memory cache to avoid hammering DB on every leaderboard request
  private _cache: { data: any; ts: number } | null = null
  private readonly CACHE_TTL = 30_000 // 30 seconds

  private mapUser(u: User, rank: number) {
    return {
      rank,
      id: u.id,
      displayName: u.gameNickname || u.username || u.firstName,
      gameNickname: u.gameNickname,
      username: u.username,
      firstName: u.firstName,
      avatarUrl: u.avatarUrl,
      elo: u.elo,
      matchesPlayed: u.matchesPlayed,
      winRate: u.winRate,
      kdr: u.kdr,
      isPremium: u.isPremium,
      isVerified: u.isVerified,
      region: u.region ?? null,
    };
  }

  async getTopByElo(limit = 100) {
    // Serve from cache for 30s — leaderboard doesn't need real-time precision
    if (this._cache && Date.now() - this._cache.ts < this.CACHE_TTL) {
      return this._cache.data;
    }
    const users = await this.userRepo.find({
      where: { isBanned: false },
      order: { elo: 'DESC', id: 'ASC' },
      take: limit,
    });
    const result = users.map((u, i) => this.mapUser(u, i + 1));
    this._cache = { data: result, ts: Date.now() };
    return result;
  }

  async getRegionalTop(region: string, limit = 100) {
    const users = await this.userRepo.find({
      where: { isBanned: false, region },
      order: { elo: 'DESC', id: 'ASC' },
      take: limit,
    });
    return users.map((u, i) => this.mapUser(u, i + 1));
  }

  async getUserRank(userId: number): Promise<number> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return 0;
    // Tie-break по id, чтобы при равном ELO ранги были уникальны
    // (иначе в «топ-5» могло бы попасть больше 5 игроков — важно для Challenger).
    const count = await this.userRepo
      .createQueryBuilder('u')
      .where('u.is_banned = false')
      .andWhere('(u.elo > :elo OR (u.elo = :elo AND u.id < :id))', {
        elo: user.elo,
        id: user.id,
      })
      .getCount();
    return count + 1;
  }
}
