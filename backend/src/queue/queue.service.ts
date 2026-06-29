import { Injectable, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';
import { MatchesService } from '../matches/matches.service';
import { AppGateway } from '../gateway/app.gateway';
import { TelegramNotifyService } from '../notifications/telegram-notify.service';

export interface QueueEntry {
  userId: number;
  elo: number;
  joinedAt: number;
  partyIds?: number[];
}

@Injectable()
export class QueueService {
  private redis: Redis;
  private readonly QUEUE_KEY = 'matchmaking:queue';

  constructor(
    private matchesService: MatchesService,
    private gateway: AppGateway,
    private tgNotify: TelegramNotifyService,
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async joinQueue(userId: number, elo: number, partyIds?: number[]): Promise<void> {
    const existing = await this.redis.hget(this.QUEUE_KEY, String(userId));
    if (existing) return;

    const entry: QueueEntry = { userId, elo, joinedAt: Date.now(), partyIds };
    await this.redis.hset(this.QUEUE_KEY, String(userId), JSON.stringify(entry));
    const size = await this.getQueueSize();
    this.gateway.emitQueueUpdate(size);
  }

  async leaveQueue(userId: number): Promise<void> {
    await this.redis.hdel(this.QUEUE_KEY, String(userId));
    const size = await this.getQueueSize();
    this.gateway.emitQueueUpdate(size);
  }

  async getQueueSize(): Promise<number> {
    return this.redis.hlen(this.QUEUE_KEY);
  }

  async getQueueEntries(): Promise<QueueEntry[]> {
    const entries = await this.redis.hgetall(this.QUEUE_KEY);
    return Object.values(entries).map((e) => JSON.parse(e));
  }

  async isInQueue(userId: number): Promise<boolean> {
    return (await this.redis.hexists(this.QUEUE_KEY, String(userId))) === 1;
  }

  @Cron('*/5 * * * * *')
  async tryMatchmaking(): Promise<void> {
    const entries = await this.getQueueEntries();
    if (entries.length < 10) return;

    const sorted = entries.sort((a, b) => a.elo - b.elo);
    const group = sorted.slice(0, 10);

    for (const entry of group) {
      await this.redis.hdel(this.QUEUE_KEY, String(entry.userId));
    }

    try {
      const match = await this.matchesService.createMatch(group.map((e) => e.userId));
      const size = await this.getQueueSize();
      this.gateway.emitQueueUpdate(size);
      this.gateway.emitMatchFound(group.map((e) => e.userId), match.id);
      for (const e of group) {
        this.tgNotify.push(e.userId, 'match_found',
          '🎮 <b>Игра найдена!</b>\nЗаходи в лобби и подтверди готовность.',
          { text: '⚔️ Открыть матч', webApp: true, path: `/match/${match.id}` });
      }
    } catch {
      for (const entry of group) {
        await this.redis.hset(this.QUEUE_KEY, String(entry.userId), JSON.stringify(entry));
      }
    }
  }
}
