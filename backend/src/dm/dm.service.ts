import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { User } from '../users/entities/user.entity';
import { DmProLobby } from './entities/dm-pro-lobby.entity';
import { AppGateway } from '../gateway/app.gateway';

const MAPS = ['PRISON', 'SANDSTONE', 'PROVINCE', 'BREEZE', 'HANAMI', 'RUST', 'DUNE'];
const WEAPONS = ['pistols', 'akr', 'snipers', 'all'];
const CONDITIONS = ['hs', 'none'];
const QUEUE_MAX = 16;
const COUNTDOWN_MS = 3 * 60 * 1000; // 3 минуты
const VOTE_MS = 25 * 1000;          // окно голосования за карту
const LINK_MS = 5 * 60 * 1000;      // у хоста 5 минут на ссылку
const LOBBY_LINK_RE = /^https:\/\/link\.standoff2\.com\/.+\/lobby\/join\/.+/i;

interface DmMatch {
  id: string;
  players: number[];
  phase: 'vote' | 'live';
  votes: Map<number, { map: string; at: number }>;
  voteExpires: number;
  map: string | null;
  hostId: number;
  link: string | null;
  linkExpires: number;
  createdAt: number;
}

@Injectable()
export class DmService {
  private queue: number[] = [];
  private countdownExpires: number | null = null;
  private queueTimer: NodeJS.Timeout | null = null;
  private matches = new Map<string, DmMatch>();
  private userMatch = new Map<number, string>();

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(DmProLobby) private proRepo: Repository<DmProLobby>,
    private gateway: AppGateway,
  ) {}

  // ── helpers ──────────────────────────────────────────────────────────────────
  private async brief(id: number) {
    const u = await this.userRepo.findOne({ where: { id } });
    return {
      id,
      nickname: u?.gameNickname || u?.firstName || `#${id}`,
      avatarUrl: u?.avatarUrl ?? null,
      elo: u?.elo ?? 1000,
      online: this.gateway.isUserOnline(id),
    };
  }
  private async briefs(ids: number[]) {
    const us = ids.length ? await this.userRepo.findBy({ id: In(ids) }) : [];
    const map = new Map(us.map((u) => [u.id, u]));
    return ids.map((id) => {
      const u = map.get(id);
      return { id, nickname: u?.gameNickname || u?.firstName || `#${id}`, avatarUrl: u?.avatarUrl ?? null, elo: u?.elo ?? 1000 };
    });
  }
  private pingQueue() { for (const uid of this.queue) this.gateway.emitToUser(uid, 'dm_queue_updated', {}); }
  private pingMatch(m: DmMatch) { for (const uid of m.players) this.gateway.emitToUser(uid, 'dm_match_updated', { id: m.id }); }

  // ── Queue ──────────────────────────────────────────────────────────────────────
  async joinQueue(userId: number) {
    if (this.userMatch.has(userId)) return this.queueStatus(userId);   // уже в DM-матче
    if (this.queue.includes(userId)) return this.queueStatus(userId);
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (u?.isBanned) throw new BadRequestException('Ваш аккаунт заблокирован');
    if (this.queue.length >= QUEUE_MAX) throw new BadRequestException('Очередь заполнена');

    this.queue.push(userId);
    if (this.queue.length >= QUEUE_MAX) { this.resolveQueue(); }
    else if (this.queue.length >= 2 && !this.countdownExpires) { this.startCountdown(); }
    this.pingQueue();
    return this.queueStatus(userId);
  }

  private startCountdown() {
    this.countdownExpires = Date.now() + COUNTDOWN_MS;
    if (this.queueTimer) clearTimeout(this.queueTimer);
    this.queueTimer = setTimeout(() => this.resolveQueue(), COUNTDOWN_MS);
  }
  private clearCountdown() {
    this.countdownExpires = null;
    if (this.queueTimer) { clearTimeout(this.queueTimer); this.queueTimer = null; }
  }

  async leaveQueue(userId: number) {
    this.queue = this.queue.filter((id) => id !== userId);
    if (this.queue.length < 2) this.clearCountdown();
    this.pingQueue();
    return this.queueStatus(userId);
  }

  async queueStatus(userId: number) {
    const activeMatchId = this.userMatch.get(userId) ?? null;
    return {
      inQueue: this.queue.includes(userId),
      size: this.queue.length,
      max: QUEUE_MAX,
      members: await this.briefs(this.queue),
      countdownExpires: this.countdownExpires,
      activeMatchId,
    };
  }

  private resolveQueue() {
    this.clearCountdown();
    if (this.queue.length < 2) { this.queue = []; return; }
    const players = [...this.queue];
    this.queue = [];
    this.createMatch(players);
  }

  private createMatch(players: number[]) {
    const id = randomUUID();
    const hostId = players[Math.floor(Math.random() * players.length)];
    const m: DmMatch = {
      id, players, phase: 'vote', votes: new Map(), voteExpires: Date.now() + VOTE_MS,
      map: null, hostId, link: null, linkExpires: 0, createdAt: Date.now(),
    };
    this.matches.set(id, m);
    for (const p of players) this.userMatch.set(p, id);
    setTimeout(() => this.resolveVote(id), VOTE_MS);
    for (const p of players) this.gateway.emitToUser(p, 'dm_match_found', { id });
  }

  // ── Vote ──────────────────────────────────────────────────────────────────────
  async vote(userId: number, dmId: string, map: string) {
    const m = this.matches.get(dmId);
    if (!m || m.phase !== 'vote') throw new BadRequestException('Голосование недоступно');
    if (!m.players.includes(userId)) throw new ForbiddenException('Вы не в этом лобби');
    if (!MAPS.includes(map)) throw new BadRequestException('Неверная карта');
    m.votes.set(userId, { map, at: Date.now() });
    this.pingMatch(m);
    return this.matchState(userId, dmId);
  }

  private resolveVote(dmId: string) {
    const m = this.matches.get(dmId);
    if (!m || m.phase !== 'vote') return;
    const counts: Record<string, { n: number; last: number }> = {};
    for (const { map, at } of m.votes.values()) {
      if (!counts[map]) counts[map] = { n: 0, last: 0 };
      counts[map].n += 1;
      counts[map].last = Math.max(counts[map].last, at);
    }
    let winner = MAPS[Math.floor(Math.random() * MAPS.length)];
    let best = { n: -1, last: -1 };
    for (const [map, c] of Object.entries(counts)) {
      if (c.n > best.n || (c.n === best.n && c.last > best.last)) { best = c; winner = map; }
    }
    m.map = winner;
    m.phase = 'live';
    m.linkExpires = Date.now() + LINK_MS;
    this.pingMatch(m);
  }

  // ── Match ─────────────────────────────────────────────────────────────────────
  async matchState(userId: number, dmId: string) {
    const m = this.matches.get(dmId);
    if (!m) return null;
    const counts: Record<string, number> = {};
    for (const { map } of m.votes.values()) counts[map] = (counts[map] ?? 0) + 1;
    return {
      id: m.id,
      phase: m.phase,
      players: await this.briefs(m.players),
      hostId: m.hostId,
      isHost: m.hostId === userId,
      inLobby: m.players.includes(userId),
      voteExpires: m.voteExpires,
      voteCounts: counts,
      myVote: m.votes.get(userId)?.map ?? null,
      map: m.map,
      link: m.link,
      linkExpires: m.linkExpires,
    };
  }

  async leaveMatch(userId: number, dmId: string) {
    const m = this.matches.get(dmId);
    if (!m) return { ok: true };
    m.players = m.players.filter((id) => id !== userId);
    m.votes.delete(userId);
    this.userMatch.delete(userId);
    if (m.players.length === 0) {
      this.matches.delete(dmId);
      return { ok: true };
    }
    if (m.hostId === userId) m.hostId = m.players[0]; // передаём хоста
    this.pingMatch(m);
    return { ok: true };
  }

  async setLink(userId: number, dmId: string, link: string) {
    const m = this.matches.get(dmId);
    if (!m) throw new BadRequestException('Лобби не найдено');
    if (m.hostId !== userId) throw new ForbiddenException('Ссылку публикует хост лобби');
    if (m.phase !== 'live') throw new BadRequestException('Ещё идёт голосование');
    const trimmed = (link || '').trim();
    if (!LOBBY_LINK_RE.test(trimmed)) throw new BadRequestException('Вставьте ссылку на лобби Standoff 2 (link.standoff2.com/…/lobby/join/…)');
    m.link = trimmed;
    this.pingMatch(m);
    return this.matchState(userId, dmId);
  }

  // ── PRO lobbies ───────────────────────────────────────────────────────────────
  async listPro() {
    const lobbies = await this.proRepo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
    const hosts = await this.briefs([...new Set(lobbies.map((l) => l.hostId))]);
    const hostMap = new Map(hosts.map((h) => [h.id, h]));
    return lobbies.map((l) => ({
      id: l.id, map: l.map, weapons: l.weapons, condition: l.condition, link: l.link,
      hostId: l.hostId, host: hostMap.get(l.hostId) ?? null, createdAt: l.createdAt,
    }));
  }

  async createPro(hostId: number, data: { map: string; weapons: string; condition: string; link: string }) {
    const u = await this.userRepo.findOne({ where: { id: hostId } });
    if (!u?.isDmHost) throw new ForbiddenException('Недостаточно прав');
    const map = (data.map || '').toUpperCase();
    if (!MAPS.includes(map)) throw new BadRequestException('Выберите карту');
    const weapons = WEAPONS.includes(data.weapons) ? data.weapons : 'all';
    const condition = CONDITIONS.includes(data.condition) ? data.condition : 'none';
    const link = (data.link || '').trim();
    if (!LOBBY_LINK_RE.test(link)) throw new BadRequestException('Вставьте ссылку на лобби Standoff 2');
    const lobby = await this.proRepo.save(this.proRepo.create({ hostId, map, weapons, condition, link, isActive: true }));
    this.gateway.emitToAll('dm_pro_updated', {});
    return lobby;
  }

  async removePro(userId: number, id: number) {
    const lobby = await this.proRepo.findOne({ where: { id } });
    if (!lobby) return { ok: true };
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (lobby.hostId !== userId && !u?.isAdmin) throw new ForbiddenException('Можно удалять только своё лобби');
    await this.proRepo.delete({ id });
    this.gateway.emitToAll('dm_pro_updated', {});
    return { ok: true };
  }
}
