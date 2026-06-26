import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { MatchesService } from './matches.service';
import { ClansService } from '../clans/clans.service';
import { ClanMatch } from '../clans/entities/clan-match.entity';
import { AppGateway } from '../gateway/app.gateway';

interface ClanQueueEntry {
  clanId: number;
  roster: number[];
  captainId: number;
  rating: number;
  joinedAt: number;
}

@Injectable()
export class ClanQueueService {
  private redis: Redis;
  private readonly KEY = 'clan_matchmaking:battle';

  constructor(
    private matchesService: MatchesService,
    private clansService: ClansService,
    @InjectRepository(ClanMatch) private clanMatchRepo: Repository<ClanMatch>,
    private gateway: AppGateway,
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  // ── Прак: ready-check 5+5 и старт ──────────────────────────────────────────
  private pracKey(scrimId: number, side: 'A' | 'B') { return `prac_ready:${scrimId}:${side}`; }

  private pracWindowOpen(scrim: ClanMatch): boolean {
    if (!scrim.scheduledAt) return true; // без времени — готовность доступна сразу
    return Date.now() >= new Date(scrim.scheduledAt).getTime() - 5 * 60 * 1000;
  }

  async pracStatus(actorId: number, scrimId: number) {
    const scrim = await this.clanMatchRepo.findOne({ where: { id: scrimId } });
    if (!scrim || scrim.mode !== 'scrim') throw new NotFoundException('Прак не найден');
    const [a, b] = await Promise.all([
      this.redis.smembers(this.pracKey(scrimId, 'A')),
      this.redis.smembers(this.pracKey(scrimId, 'B')),
    ]);
    const myClan = await this.clansService.clanIdOfUser(actorId);
    const side = myClan === scrim.clanAId ? 'A' : myClan === scrim.clanBId ? 'B' : null;
    return {
      status: scrim.status,
      matchId: scrim.matchId ?? null,
      windowOpen: this.pracWindowOpen(scrim),
      readyA: a.length, readyB: b.length,
      mySide: side,
      iAmReady: side ? (side === 'A' ? a : b).includes(String(actorId)) : false,
    };
  }

  async pracReady(actorId: number, scrimId: number) {
    const scrim = await this.clanMatchRepo.findOne({ where: { id: scrimId } });
    if (!scrim || scrim.mode !== 'scrim') throw new NotFoundException('Прак не найден');
    if (scrim.status !== 'accepted') throw new BadRequestException('Прак уже недоступен');
    if (!this.pracWindowOpen(scrim)) throw new BadRequestException('Готовность откроется за 5 минут до начала');

    const myClan = await this.clansService.clanIdOfUser(actorId);
    const side: 'A' | 'B' | null = myClan === scrim.clanAId ? 'A' : myClan === scrim.clanBId ? 'B' : null;
    if (!side) throw new BadRequestException('Ваш клан не участвует в этом праке');

    const active = await this.matchesService.getMyActiveMatch(actorId);
    if (active) throw new BadRequestException('Вы уже в матче');

    await this.redis.sadd(this.pracKey(scrimId, side), String(actorId));
    const [aMembers, bMembers] = await Promise.all([
      this.redis.smembers(this.pracKey(scrimId, 'A')),
      this.redis.smembers(this.pracKey(scrimId, 'B')),
    ]);
    this.gateway.emitToClan(scrim.clanAId, 'clan_update', { reason: 'prac_ready', scrimId });
    this.gateway.emitToClan(scrim.clanBId, 'clan_update', { reason: 'prac_ready', scrimId });

    if (aMembers.length >= 5 && bMembers.length >= 5) {
      const rosterA = aMembers.slice(0, 5).map(Number);
      const rosterB = bMembers.slice(0, 5).map(Number);
      const match = await this.matchesService.createPracMatch(scrim.clanAId, scrim.clanBId, rosterA, rosterB, scrim.map);
      scrim.status = 'completed';
      scrim.matchId = match.id;
      await this.clanMatchRepo.save(scrim);
      await this.redis.del(this.pracKey(scrimId, 'A'), this.pracKey(scrimId, 'B'));
      for (const uid of [...rosterA, ...rosterB]) this.gateway.emitToUser(uid, 'match_found', { matchId: match.id });
      return { started: true, matchId: match.id };
    }
    return { started: false, readyA: aMembers.length, readyB: bMembers.length };
  }

  async pracCancel(actorId: number, scrimId: number) {
    const scrim = await this.clanMatchRepo.findOne({ where: { id: scrimId } });
    if (!scrim || scrim.mode !== 'scrim') throw new NotFoundException('Прак не найден');
    const myClan = await this.clansService.clanIdOfUser(actorId);
    const side: 'A' | 'B' | null = myClan === scrim.clanAId ? 'A' : myClan === scrim.clanBId ? 'B' : null;
    if (side) await this.redis.srem(this.pracKey(scrimId, side), String(actorId));
    this.gateway.emitToClan(scrim.clanAId, 'clan_update', { reason: 'prac_ready', scrimId });
    this.gateway.emitToClan(scrim.clanBId, 'clan_update', { reason: 'prac_ready', scrimId });
    return { ok: true };
  }

  // Лидер/со-лидер ставит клан (ростер из 5) в очередь кланового подбора
  async join(actorId: number, memberIds: number[]) {
    const { clanId, roster } = await this.clansService.validateRoster(actorId, memberIds);
    const brief = await this.clansService.clanBrief(clanId);

    // не должно быть активного матча у игроков ростера
    for (const uid of roster) {
      const active = await this.matchesService.getMyActiveMatch(uid);
      if (active) throw new BadRequestException('Кто-то из состава уже в матче');
    }

    const entry: ClanQueueEntry = {
      clanId, roster, captainId: actorId,
      rating: brief?.rating ?? 1000, joinedAt: Date.now(),
    };
    await this.redis.hset(this.KEY, String(clanId), JSON.stringify(entry));
    this.gateway.emitToClan(clanId, 'clan_update', { reason: 'searching' });
    return { searching: true, roster, clanId };
  }

  async leave(actorId: number) {
    const clanId = await this.clansService.clanIdOfUser(actorId);
    if (clanId == null) return { searching: false };
    await this.redis.hdel(this.KEY, String(clanId));
    this.gateway.emitToClan(clanId, 'clan_update', { reason: 'search_cancelled' });
    return { searching: false };
  }

  async status(actorId: number) {
    const clanId = await this.clansService.clanIdOfUser(actorId);
    if (clanId == null) return { searching: false };
    const raw = await this.redis.hget(this.KEY, String(clanId));
    if (!raw) return { searching: false };
    const entry: ClanQueueEntry = JSON.parse(raw);
    const size = await this.redis.hlen(this.KEY);
    return { searching: true, roster: entry.roster, captainId: entry.captainId, queueSize: size };
  }

  private async entries(): Promise<ClanQueueEntry[]> {
    const all = await this.redis.hgetall(this.KEY);
    return Object.values(all).map((e) => JSON.parse(e));
  }

  @Cron('*/5 * * * * *')
  async tryMatch(): Promise<void> {
    const entries = await this.entries();
    if (entries.length < 2) return;

    // сортируем по рейтингу и пэйрим соседей (ближайшие по силе)
    const sorted = entries.sort((a, b) => a.rating - b.rating);
    const a = sorted[0];
    const b = sorted[1];

    // снимаем обоих из очереди до создания матча
    await this.redis.hdel(this.KEY, String(a.clanId));
    await this.redis.hdel(this.KEY, String(b.clanId));

    try {
      const match = await this.matchesService.createClanBattle(
        { clanId: a.clanId, roster: a.roster, captainId: a.captainId },
        { clanId: b.clanId, roster: b.roster, captainId: b.captainId },
      );
      const allPlayers = [...a.roster, ...b.roster];
      for (const uid of allPlayers) this.gateway.emitToUser(uid, 'match_found', { matchId: match.id });
      this.gateway.emitToClan(a.clanId, 'clan_update', { reason: 'match_found', matchId: match.id });
      this.gateway.emitToClan(b.clanId, 'clan_update', { reason: 'match_found', matchId: match.id });
    } catch {
      // вернуть в очередь при ошибке
      await this.redis.hset(this.KEY, String(a.clanId), JSON.stringify(a));
      await this.redis.hset(this.KEY, String(b.clanId), JSON.stringify(b));
    }
  }
}
