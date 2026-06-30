import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios from 'axios';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import FormData from 'form-data';
import { tgPost } from '../common/telegram';
import { Match, MatchStatus, MAPS } from './entities/match.entity';
import { MatchPlayer } from './entities/match-player.entity';
import { MatchMessage } from './entities/match-message.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AppGateway } from '../gateway/app.gateway';
import { DiscordService, MatchTeams } from '../discord/discord.service';
import { ClansService } from '../clans/clans.service';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(MatchPlayer) private playerRepo: Repository<MatchPlayer>,
    @InjectRepository(MatchMessage) private msgRepo: Repository<MatchMessage>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    private gateway: AppGateway,
    private discordService: DiscordService,
    private clansService: ClansService,
  ) {}

  // ── Клановый бой 5x5 ──────────────────────────────────────────────────────
  // Создаёт обычный Match с фиксированными ростерами (без перетасовки),
  // капитанами-инициаторами и клановыми флагами. Дальше — стандартный
  // ready-check → вето → лобби → результат.
  async createClanBattle(
    a: { clanId: number; roster: number[]; captainId: number },
    b: { clanId: number; roster: number[]; captainId: number },
  ): Promise<Match> {
    const users = await this.userRepo.findBy({ id: In([...a.roster, ...b.roster]) });
    const eloMap = Object.fromEntries(users.map((u) => [u.id, u.elo]));
    const avg = (ids: number[]) => ids.length ? Math.round(ids.reduce((s, id) => s + (eloMap[id] ?? 1000), 0) / ids.length) : 1000;
    const match = this.matchRepo.create({
      status: MatchStatus.READY_CHECK,
      teamAIds: a.roster,
      teamBIds: b.roster,
      teamAElo: avg(a.roster),
      teamBElo: avg(b.roster),
      hostId: a.captainId,
      captainAId: a.captainId,
      captainBId: b.captainId,
      availableMaps: [...MAPS],
      readyPlayers: [],
      readyCheckExpires: new Date(Date.now() + 30000),
      isClanMatch: true,
      clanMode: 'battle',
      clanAId: a.clanId,
      clanBId: b.clanId,
    });
    return this.matchRepo.save(match);
  }

  // Прак: создаётся сразу IN_PROGRESS (готовность уже подтверждена), без вето,
  // карта из заявки, случайный хост. Результаты не сохраняются.
  async createPracMatch(
    clanAId: number, clanBId: number, rosterA: number[], rosterB: number[], map: string | null,
  ): Promise<Match> {
    const all = [...rosterA, ...rosterB];
    const users = await this.userRepo.findBy({ id: In(all) });
    const eloMap = Object.fromEntries(users.map((u) => [u.id, u.elo]));
    const avg = (ids: number[]) => ids.length ? Math.round(ids.reduce((s, id) => s + (eloMap[id] ?? 1000), 0) / ids.length) : 1000;
    const host = all[Math.floor(Math.random() * all.length)];
    const match = this.matchRepo.create({
      status: MatchStatus.IN_PROGRESS,
      teamAIds: rosterA,
      teamBIds: rosterB,
      teamAElo: avg(rosterA),
      teamBElo: avg(rosterB),
      hostId: host,
      captainAId: rosterA[0],
      captainBId: rosterB[0],
      map: map || MAPS[Math.floor(Math.random() * MAPS.length)],
      availableMaps: [],
      readyPlayers: all,
      teamASide: Math.random() < 0.5 ? 'T' : 'CT',
      startedAt: new Date(),
      isClanMatch: true,
      clanMode: 'prac',
      clanAId, clanBId,
    });
    const saved = await this.matchRepo.save(match);
    await this.createMatchPlayers(saved);
    return saved;
  }

  // Выход из прака (через 5 минут после старта). Результаты не сохраняются — матч просто закрывается.
  async leavePrac(matchId: number, userId: number): Promise<{ ok: boolean }> {
    const match = await this.getMatch(matchId);
    if (!match.isClanMatch || match.clanMode !== 'prac') throw new BadRequestException('Это не прак');
    if (![...match.teamAIds, ...match.teamBIds].includes(userId)) throw new BadRequestException('Вы не участник прака');
    const SUBMIT_DELAY_MS = 5 * 60 * 1000;
    if (!match.startedAt || Date.now() - new Date(match.startedAt).getTime() < SUBMIT_DELAY_MS) {
      throw new BadRequestException('Выйти можно через 5 минут после начала');
    }
    if (match.status === MatchStatus.IN_PROGRESS) {
      match.status = MatchStatus.CANCELLED;
      match.endedAt = new Date();
      const saved = await this.matchRepo.save(match);
      this.gateway.emitToMatch(matchId, 'match_updated', saved);
    }
    return { ok: true };
  }

  // Применяет рейтинг клана и пишет историю по завершённому клановому бою.
  // Идемпотентно по eloChange-флагу (повторный вызов ничего не делает).
  private async finalizeClanBattle(match: Match): Promise<void> {
    if (!match.isClanMatch || match.clanMode !== 'battle') return;
    if (match.clanAId == null || match.clanBId == null) return;
    if (match.eloChange === 1) return; // уже обработан
    const scoreA = match.scoreA ?? 0;
    const scoreB = match.scoreB ?? 0;
    try {
      await this.clansService.recordClanMatchResult({
        clanAId: match.clanAId, clanBId: match.clanBId, scoreA, scoreB, map: match.map ?? null,
      });
    } catch {}
    match.eloChange = 1; // маркер «рейтинг применён» (личный ELO в клановых боях не используется)
    await this.matchRepo.save(match);
  }

  // ── 2v2 Lobby helpers ─────────────────────────────────────────────────────

  /** Find the READY_CHECK 2v2 lobby this user is currently in (if any). */
  private async findUser2v2Lobby(userId: number): Promise<Match | null> {
    const openMatches = await this.matchRepo.find({ where: { status: MatchStatus.READY_CHECK, isLobby: true } });
    return (
      openMatches.find(
        (m) =>
          m.teamAIds.length + m.teamBIds.length === 10 &&
          [...m.teamAIds, ...m.teamBIds].includes(userId),
      ) ?? null
    );
  }

  /** Count unfilled placeholder slots in a 2v2 lobby. */
  private lobbyPlaceholders(match: Match): number {
    const h = match.hostId;
    return (
      match.teamAIds.slice(1).filter((id) => id === h).length +
      match.teamBIds.filter((id) => id === h).length
    );
  }

  // ── 2v2 Public Lobby ──────────────────────────────────────────────────────

  /** Returns the lobby the requesting user is in, or null. */
  async getActiveLobby2v2(userId: number): Promise<{
    matchId: number;
    players: { id: number; name: string }[];
    slots: number;
    filled: number;
  } | null> {
    const match = await this.findUser2v2Lobby(userId);
    if (!match) return null;

    const allIds = [...match.teamAIds, ...match.teamBIds];
    const uniqueIds = [...new Set(allIds)];
    const users = uniqueIds.length ? await this.userRepo.findBy({ id: In(uniqueIds) }) : [];
    const nameMap = Object.fromEntries(users.map((u) => [u.id, u.gameNickname || u.firstName]));

    const placeholders = this.lobbyPlaceholders(match);
    const filled = allIds.length - placeholders;

    return {
      matchId: match.id,
      players: uniqueIds.map((id) => ({ id, name: nameMap[id] || `#${id}` })),
      slots: allIds.length,
      filled,
    };
  }

  /**
   * Join an existing open 2v2 lobby, or create a new one if none is available.
   * If the user is already in a lobby, returns that lobby.
   */
  async joinOrCreateLobby2v2(userId: number, league: string | null = null): Promise<Match> {
    const userCheck = await this.userRepo.findOne({ where: { id: userId } });
    if (userCheck?.isBanned) throw new BadRequestException('Ваш аккаунт заблокирован');
    // Гейт доступа к лигам — выдаётся вручную админом.
    if (league === 'cpl' && !userCheck?.cplAccess) throw new BadRequestException('Нет доступа к CPL');
    if (league === 'cplq' && !userCheck?.cplqAccess) throw new BadRequestException('Нет доступа к CPL-Q');

    // Already in a lobby → return it
    const existing = await this.findUser2v2Lobby(userId);
    if (existing) {
      this.gateway.emitMatchFound([userId], existing.id);
      return existing;
    }

    // Look for any open lobby (того же режима/лиги) with free slots that we can join
    const openMatches = await this.matchRepo.find({ where: { status: MatchStatus.READY_CHECK, isLobby: true } });
    const joinable = openMatches.find(
      (m) =>
        (m.league ?? null) === (league ?? null) &&
        (!m.partyGroups || m.partyGroups.length === 0) &&
        m.teamAIds.length + m.teamBIds.length === 10 &&
        ![...m.teamAIds, ...m.teamBIds].includes(userId) &&
        this.lobbyPlaceholders(m) > 0,
    );

    if (joinable) {
      return this.fillLobbySlot(joinable, userId);
    }

    // No open lobby → create a fresh one
    return this.createLobby2v2(userId, league);
  }

  /** Create a brand-new 2v2 lobby for userId. */
  async createLobby2v2(userId: number, league: string | null = null): Promise<Match> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const match = this.matchRepo.create({
      status: MatchStatus.READY_CHECK,
      isLobby: true,
      league: league ?? null,
      // Полноценный матчмейкинг 5v5: создатель занимает все 10 слотов как плейсхолдеры,
      // реальные игроки заменяют их при входе.
      teamAIds: [userId, userId, userId, userId, userId],
      teamBIds: [userId, userId, userId, userId, userId],
      teamAElo: user.elo,
      teamBElo: user.elo,
      hostId: userId,
      availableMaps: [...MAPS],
      readyPlayers: [],
      readyCheckExpires: new Date(Date.now() + 1_800_000), // 30 min queue wait
    });

    const saved = await this.matchRepo.save(match);
    this.gateway.emitMatchFound([userId], saved.id);
    return saved;
  }

  /** Put userId into a free placeholder slot in the given match. */
  private async fillLobbySlot(match: Match, userId: number): Promise<Match> {
    const hostId = match.hostId;

    const findAndReplace = (ids: number[], skipFirst = false): number[] | null => {
      const start = skipFirst ? 1 : 0;
      const idx = ids.findIndex((id, i) => i >= start && id === hostId);
      if (idx === -1) return null;
      const updated = [...ids];
      updated[idx] = userId;
      return updated;
    };

    const newB = findAndReplace(match.teamBIds);
    if (newB) {
      match.teamBIds = newB;
    } else {
      const newA = findAndReplace(match.teamAIds, true);
      if (newA) {
        match.teamAIds = newA;
      } else {
        throw new BadRequestException('Очередь уже заполнена');
      }
    }

    const saved = await this.matchRepo.save(match);
    this.gateway.emitMatchFound([userId], saved.id);
    return saved;
  }

  async leaveLobby2v2(userId: number): Promise<{ cancelled: boolean }> {
    const match = await this.findUser2v2Lobby(userId);
    if (!match) return { cancelled: false };

    // Free up this player's slot(s) by replacing with placeholder (hostId)
    match.teamAIds = match.teamAIds.map((id) => (id === userId ? match.hostId : id));
    match.teamBIds = match.teamBIds.map((id) => (id === userId ? match.hostId : id));

    // Cancel only if no real players remain (everyone left)
    const allIds = [...match.teamAIds, ...match.teamBIds];
    const realPlayers = new Set(allIds.filter((id) => id !== match.hostId));
    const hostStillReal = match.hostId !== userId;
    if (realPlayers.size === 0 && !hostStillReal) {
      match.status = MatchStatus.CANCELLED;
      await this.matchRepo.save(match);
      this.discordService.deleteMatchVoiceRooms(match.voiceChannelTId, match.voiceChannelCTId).catch(() => {});
      return { cancelled: true };
    }

    // If the host left but others remain, transfer host to first real player
    if (!hostStillReal && realPlayers.size > 0) {
      const newHost = [...realPlayers][0];
      match.hostId = newHost;
      match.teamAIds = match.teamAIds.map((id) => (id === userId ? newHost : id));
      match.teamBIds = match.teamBIds.map((id) => (id === userId ? newHost : id));
    }

    await this.matchRepo.save(match);
    return { cancelled: false };
  }

  /** @deprecated Use joinOrCreateLobby2v2 instead. Kept for backward compat. */
  async joinLobby2v2(userId: number): Promise<Match> {
    return this.joinOrCreateLobby2v2(userId);
  }

  /**
   * Завести отряд (2–5 игроков) в поиск одним блоком. Все попадают в одно лобби,
   * а балансер при старте гарантированно оставляет их в одной команде.
   * Правило: в одном лобби максимум один отряд (упрощает корректное деление 5×5).
   */
  async joinLobbyAsParty(memberIds: number[]): Promise<Match> {
    const ids = [...new Set(memberIds)].filter(Boolean);
    if (ids.length < 2) return this.joinOrCreateLobby2v2(ids[0]);
    if (ids.length > 5) throw new BadRequestException('Максимум 5 игроков в отряде');

    const users = await this.userRepo.findBy({ id: In(ids) });
    if (users.some((u) => u.isBanned)) throw new BadRequestException('Один из участников заблокирован');
    for (const uid of ids) {
      if (await this.findUser2v2Lobby(uid)) throw new BadRequestException('Кто-то из отряда уже в поиске');
    }

    // Лобби без отряда, с достаточным числом свободных слотов, где никого из нас ещё нет
    const openMatches = await this.matchRepo.find({ where: { status: MatchStatus.READY_CHECK, isLobby: true } });
    let lobby =
      openMatches.find(
        (m) =>
          (!m.partyGroups || m.partyGroups.length === 0) &&
          m.teamAIds.length + m.teamBIds.length === 10 &&
          this.lobbyPlaceholders(m) >= ids.length &&
          !ids.some((id) => [...m.teamAIds, ...m.teamBIds].includes(id)),
      ) ?? null;

    const [leaderId, ...rest] = ids;
    if (!lobby) {
      lobby = await this.createLobby2v2(leaderId); // лидер занимает teamA[0], остальные слоты — плейсхолдеры
      for (const uid of rest) lobby = await this.fillLobbySlot(lobby, uid);
    } else {
      for (const uid of ids) lobby = await this.fillLobbySlot(lobby, uid);
    }

    lobby.partyGroups = [ids];
    const saved = await this.matchRepo.save(lobby);
    this.gateway.emitMatchFound(ids, saved.id);
    return saved;
  }

  async createMatch(playerIds: number[]): Promise<Match> {
    if (playerIds.length !== 10) {
      throw new BadRequestException('Exactly 10 players required');
    }

    const users = await this.userRepo.findBy({ id: In(playerIds) });
    const { teamA, teamB } = this.balanceTeams(users);

    const match = this.matchRepo.create({
      status: MatchStatus.READY_CHECK,
      teamAIds: teamA.map((u) => u.id),
      teamBIds: teamB.map((u) => u.id),
      teamAElo: Math.round(teamA.reduce((s, u) => s + u.elo, 0) / 5),
      teamBElo: Math.round(teamB.reduce((s, u) => s + u.elo, 0) / 5),
      hostId: teamA[0].id,
      availableMaps: [...MAPS],
      readyPlayers: [],
      readyCheckExpires: new Date(Date.now() + 30000),
    });

    return this.matchRepo.save(match);
  }

  private balanceTeams(users: User[]): { teamA: User[]; teamB: User[] } {
    const sorted = [...users].sort((a, b) => b.elo - a.elo);
    let bestDiff = Infinity;
    let bestA: User[] = sorted.slice(0, 5);
    let bestB: User[] = sorted.slice(5);

    const indices = Array.from({ length: 10 }, (_, i) => i);
    const combinations = this.getCombinations(indices, 5);

    for (const combo of combinations.slice(0, 252)) {
      const teamA = combo.map((i) => sorted[i]);
      const teamB = indices.filter((i) => !combo.includes(i)).map((i) => sorted[i]);
      const diff = Math.abs(
        teamA.reduce((s, u) => s + u.elo, 0) - teamB.reduce((s, u) => s + u.elo, 0),
      );
      if (diff < bestDiff) {
        bestDiff = diff;
        bestA = teamA;
        bestB = teamB;
      }
    }

    return { teamA: bestA, teamB: bestB };
  }

  /**
   * Делит 10 игроков на 5×5 так, чтобы отряд (party) целиком был в одной команде,
   * добивая его команду соло-игроками для наилучшего баланса по среднему ELO.
   */
  private balancePartyTeams(playerIds: number[], eloMap: Record<number, number>, party: number[]): { teamA: number[]; teamB: number[] } {
    const solos = playerIds.filter((id) => !party.includes(id));
    const need = 5 - party.length; // сколько соло добрать в команду отряда
    const partyElo = party.reduce((s, id) => s + (eloMap[id] ?? 1000), 0);
    if (need <= 0) return { teamA: [...party], teamB: solos };

    let best: { teamA: number[]; teamB: number[] } | null = null;
    let bestDiff = Infinity;
    const idxs = solos.map((_, i) => i);
    for (const combo of this.getCombinations(idxs, need)) {
      const inA = new Set(combo);
      const aSolos = combo.map((i) => solos[i]);
      const bSolos = solos.filter((_, i) => !inA.has(i));
      const eloA = partyElo + aSolos.reduce((s, id) => s + (eloMap[id] ?? 1000), 0);
      const eloB = bSolos.reduce((s, id) => s + (eloMap[id] ?? 1000), 0);
      const diff = Math.abs(eloA - eloB);
      if (diff < bestDiff) { bestDiff = diff; best = { teamA: [...party, ...aSolos], teamB: bSolos }; }
    }
    return best ?? { teamA: [...party, ...solos.slice(0, need)], teamB: solos.slice(need) };
  }

  private getCombinations(arr: number[], k: number): number[][] {
    const result: number[][] = [];
    const combo: number[] = [];

    const backtrack = (start: number) => {
      if (combo.length === k) {
        result.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        backtrack(i + 1);
        combo.pop();
      }
    };

    backtrack(0);
    return result;
  }

  async playerReady(matchId: number, userId: number): Promise<Match> {
    const match = await this.getMatch(matchId);
    if (match.status !== MatchStatus.READY_CHECK) {
      throw new BadRequestException('Match is not in ready check phase');
    }

    // Block ready if lobby still has placeholder slots (duplicate IDs)
    const allPlayers = [...match.teamAIds, ...match.teamBIds];
    const uniquePlayers = new Set(allPlayers);
    if (uniquePlayers.size < allPlayers.length) {
      throw new BadRequestException('Ожидаем остальных игроков');
    }

    if (!match.readyPlayers.includes(userId)) {
      match.readyPlayers = [...match.readyPlayers, userId];
    }

    if (match.readyPlayers.length >= uniquePlayers.size && match.isClanMatch) {
      // Клановый бой: команды и капитаны фиксированы (ростеры кланов) — не перетасовываем.
      match.status = MatchStatus.MAP_VETO;
      match.vetoTurn = 'A';
      match.vetoPhase = 0;
      match.availableMaps = [...MAPS];
      match.vetoTurnExpires = new Date(Date.now() + 15000);
      const savedClan = await this.matchRepo.save(match);
      this.gateway.emitToMatch(matchId, 'match_updated', savedClan);
      return savedClan;
    }

    if (match.readyPlayers.length >= uniquePlayers.size) {
      // ── ELO-balanced 5v5 team distribution ──
      const playerIds = [...uniquePlayers];
      const users = await this.userRepo.findBy({ id: In(playerIds) });
      const eloMap = Object.fromEntries(users.map((u) => [u.id, u.elo]));

      // Если в лобби есть отряд — держим его в одной команде; иначе обычный баланс 5×5.
      const party = match.partyGroups && match.partyGroups[0]
        ? match.partyGroups[0].filter((id) => playerIds.includes(id))
        : [];
      let teamA: number[]; let teamB: number[];
      if (party.length >= 2 && party.length <= 5) {
        ({ teamA, teamB } = this.balancePartyTeams(playerIds, eloMap, party));
      } else {
        const { teamA: balA, teamB: balB } = this.balanceTeams(users);
        teamA = balA.map((u) => u.id);
        teamB = balB.map((u) => u.id);
      }

      match.teamAIds = teamA;
      match.teamBIds = teamB;

      // ── Store accurate avg ELO per team for the ELO change formula ──
      const avg = (ids: number[]) =>
        ids.length ? Math.round(ids.reduce((s, id) => s + (eloMap[id] ?? 0), 0) / ids.length) : 0;
      match.teamAElo = avg(teamA);
      match.teamBElo = avg(teamB);

      // ── Captains: highest ELO in each team ──
      match.captainAId = teamA.reduce((cap, id) =>
        (eloMap[id] ?? 0) >= (eloMap[cap] ?? 0) ? id : cap, teamA[0]);
      match.captainBId = teamB.reduce((cap, id) =>
        (eloMap[id] ?? 0) >= (eloMap[cap] ?? 0) ? id : cap, teamB[0]);

      match.status = MatchStatus.MAP_VETO;
      match.vetoTurn = 'A';
      match.vetoPhase = 0;
      match.availableMaps = [...MAPS];
      match.vetoTurnExpires = new Date(Date.now() + 15000);
    }

    const saved = await this.matchRepo.save(match);
    this.gateway.emitToMatch(matchId, 'match_updated', saved);
    return saved;
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async expireReadyCheck(matchId: number): Promise<Match> {
    const match = await this.getMatch(matchId);
    if (match.status !== MatchStatus.READY_CHECK) return match;
    if (match.readyCheckExpires && new Date() < new Date(match.readyCheckExpires)) return match;

    // Check if the lobby was actually full (all 4 slots had unique players).
    // If NOT full — player was just waiting in queue, no penalty.
    // Only penalize those who ignored the ready check when the lobby WAS full.
    const uniquePlayers = [...new Set([...match.teamAIds, ...match.teamBIds])];
    const isLobbyFull = uniquePlayers.length === 10;

    if (isLobbyFull) {
      const dodgers = uniquePlayers.filter((id) => !match.readyPlayers.includes(id));
      for (const userId of dodgers) {
        await this.applyDodgePenalty(userId);
      }
    }
    // If lobby was not full — just silently cancel, no one is to blame

    match.status = MatchStatus.CANCELLED;
    const saved = await this.matchRepo.save(match);
    this.gateway.emitToMatch(matchId, 'match_updated', saved);

    // Clean up Discord voice rooms if they were created
    this.discordService
      .deleteMatchVoiceRooms(match.voiceChannelTId, match.voiceChannelCTId)
      .catch(() => {});

    return saved;
  }

  /** -10 ELO + 1.5 min cooldown for missing ready check. */
  /** Наказание за пропуск ready check — только кулдаун (без снятия ELO). */
  private async applyDodgePenalty(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;
    user.cooldownUntil = new Date(Date.now() + 90_000); // 90 секунд кулдаун
    await this.userRepo.save(user);

    await this.notifRepo.save(
      this.notifRepo.create({
        userId,
        type: 'penalty',
        title: '⏱️ Штраф: пропуск ready check',
        body: 'Вы не приняли ready check. Кулдаун 1.5 минуты.',
        meta: { type: 'dodge' },
      }),
    );
  }

  // Сериализация вето-операций по матчу: исключает гонку (двойной бан → два набора
  // голосовых комнат). Каждая операция перечитывает матч уже внутри очереди.
  private vetoChain = new Map<number, Promise<any>>();
  private runVetoExclusive<T>(matchId: number, task: () => Promise<T>): Promise<T> {
    const prev = this.vetoChain.get(matchId) ?? Promise.resolve();
    const run = prev.catch(() => {}).then(() => task());
    this.vetoChain.set(matchId, run.catch(() => {}));
    return run;
  }

  async vetoMap(matchId: number, userId: number, mapName: string): Promise<Match> {
    return this.runVetoExclusive(matchId, async () => {
      const match = await this.getMatch(matchId);
      if (match.status !== MatchStatus.MAP_VETO) {
        throw new BadRequestException('Not in veto phase');
      }

      // Only the captain of the current team may veto
      const captainId = match.vetoTurn === 'A' ? match.captainAId : match.captainBId;
      const allTeamIds = [...match.teamAIds, ...match.teamBIds];
      const isTestMatch = new Set(allTeamIds).size === 1; // admin test mode
      if (!isTestMatch && userId !== captainId) {
        throw new BadRequestException('Только капитан команды может делать вето');
      }

      if (!match.availableMaps.includes(mapName)) {
        throw new BadRequestException('Map not available');
      }

      return this.applyVetoBan(match, mapName);
    });
  }

  // Авто-бан по истечении 15 секунд хода капитана. Вызывается клиентами по таймеру.
  async expireVetoTurn(matchId: number): Promise<Match> {
    return this.runVetoExclusive(matchId, async () => {
      const match = await this.getMatch(matchId);
      if (match.status !== MatchStatus.MAP_VETO) return match;
      if (!match.vetoTurnExpires || new Date() < new Date(match.vetoTurnExpires)) return match;
      if (match.availableMaps.length <= 1) return match;
      // случайная карта из оставшихся
      const map = match.availableMaps[Math.floor(Math.random() * match.availableMaps.length)];
      return this.applyVetoBan(match, map);
    });
  }

  // Общая логика бана карты: убирает карту, либо завершает вето, либо передаёт ход (15с).
  // Вызывается только внутри runVetoExclusive — операции по матчу сериализованы.
  private async applyVetoBan(match: Match, mapName: string): Promise<Match> {
    // защита от повторного завершения: матч уже не в вето или комнаты уже созданы
    if (match.status !== MatchStatus.MAP_VETO) return match;
    if (!match.availableMaps.includes(mapName)) return match;
    match.availableMaps = match.availableMaps.filter((m) => m !== mapName);
    match.vetoPhase += 1;

    let finalize = false;
    if (match.availableMaps.length === 1) {
      match.map = match.availableMaps[0];
      match.status = MatchStatus.IN_PROGRESS;
      match.startedAt = new Date();
      match.vetoTurnExpires = null as any;
      // ── Random side assignment ──
      match.teamASide = Math.random() < 0.5 ? 'T' : 'CT';
      await this.createMatchPlayers(match);
      finalize = true;
    } else {
      match.vetoTurn = match.vetoTurn === 'A' ? 'B' : 'A';
      match.vetoTurnExpires = new Date(Date.now() + 15000);
    }

    // Сохраняем и моментально отдаём результат — НЕ ждём Discord (иначе подвисание).
    const saved = await this.matchRepo.save(match);
    this.gateway.emitToMatch(match.id, 'match_updated', saved);

    // Голосовые комнаты создаём в фоне; когда готовы — отдельный апдейт матча.
    if (finalize && !match.isClanMatch && !match.voiceChannelTId) {
      this.createVoiceRoomsInBackground(saved.id).catch(() => {});
    }
    return saved;
  }

  // Защита от одновременного создания комнат для одного матча (несколько поллингов).
  private voiceCreating = new Set<number>();

  // Фоновое создание Discord-комнат (не блокирует завершение вето).
  // Идемпотентно и с дозагрузкой: если бот был не готов при старте матча —
  // комнаты создадутся при первом поллинге, когда бот поднимется.
  private async createVoiceRoomsInBackground(matchId: number): Promise<void> {
    if (this.voiceCreating.has(matchId)) return;
    const match = await this.getMatch(matchId);
    if (match.status !== MatchStatus.IN_PROGRESS || match.isClanMatch || match.voiceChannelTId) return;
    if (!this.discordService.isReady()) return; // бот ещё не готов — попробуем при следующем поллинге

    this.voiceCreating.add(matchId);
    try {
      const allIds   = [...match.teamAIds, ...match.teamBIds];
      const allUsers = await this.userRepo.findBy({ id: In(allIds) });
      const userMap  = new Map(allUsers.map(u => [u.id, u.discordUsername ?? '']));
      const teamADiscord = match.teamAIds.map(id => userMap.get(id) ?? '').filter(Boolean);
      const teamBDiscord = match.teamBIds.map(id => userMap.get(id) ?? '').filter(Boolean);
      const teams = {
        matchId: match.id,
        teamT:  match.teamASide === 'T' ? teamADiscord : teamBDiscord,
        teamCT: match.teamASide === 'CT' ? teamADiscord : teamBDiscord,
      };
      const rooms = await this.discordService.createMatchVoiceRooms(match.id, 5, teams);
      if (!rooms) return;
      // перечитываем на случай гонки и проставляем поля
      const fresh = await this.getMatch(matchId);
      if (fresh.status !== MatchStatus.IN_PROGRESS || fresh.voiceChannelTId) {
        // комнаты уже не нужны — чистим за собой
        this.discordService.deleteMatchVoiceRooms(rooms.channelTId, rooms.channelCTId).catch(() => {});
        return;
      }
      fresh.voiceChannelTId  = rooms.channelTId;
      fresh.voiceChannelCTId = rooms.channelCTId;
      fresh.voiceInviteT     = rooms.inviteT;
      fresh.voiceInviteCT    = rooms.inviteCT;
      const saved = await this.matchRepo.save(fresh);
      this.gateway.emitToMatch(matchId, 'match_updated', saved);
    } finally {
      this.voiceCreating.delete(matchId);
    }
  }

  private async createMatchPlayers(match: Match): Promise<void> {
    // Идемпотентно: если строки уже есть (повторный вызов / гонка при вето) —
    // не создаём дубли, иначе матч задваивается в истории и стата/ELO
    // раскидываются по разным строкам.
    const existing = await this.playerRepo.find({ where: { matchId: match.id } });
    const have = new Set(existing.map((p) => p.userId));

    const players = [
      ...match.teamAIds.map((id) => ({ userId: id, team: 'A' })),
      ...match.teamBIds.map((id) => ({ userId: id, team: 'B' })),
    ];

    for (const p of players) {
      if (have.has(p.userId)) continue;
      const user = await this.userRepo.findOne({ where: { id: p.userId } });
      await this.playerRepo.save(
        this.playerRepo.create({
          matchId: match.id,
          userId: p.userId,
          team: p.team,
          eloBefore: user?.elo || 1000,
        }),
      );
    }
  }

  async submitResult(
    matchId: number,
    userId: number,
    scoreA: number,
    scoreB: number,
    screenshotUrl: string,
  ): Promise<Match> {
    const match = await this.getMatch(matchId);
    if (match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Match is not in progress');
    }

    const isTeamA = match.teamAIds.includes(userId);
    const isTeamB = match.teamBIds.includes(userId);
    if (!isTeamA && !isTeamB) throw new BadRequestException('Not a match participant');

    // Only captain can submit
    const isCaptain = userId === match.captainAId || userId === match.captainBId;
    if (!isCaptain) throw new BadRequestException('Только капитан команды может загрузить результат');

    // Lobby link must be published first
    if (!match.lobbyLink) throw new BadRequestException('Хост ещё не опубликовал ссылку на лобби');

    // Must wait 5 minutes after match start
    const SUBMIT_DELAY_MS = 5 * 60 * 1000;
    if (!match.startedAt || Date.now() - new Date(match.startedAt).getTime() < SUBMIT_DELAY_MS) {
      throw new BadRequestException('Результат можно загрузить только через 5 минут после начала матча');
    }

    // Store each captain's submission independently
    if (userId === match.captainAId) {
      match.resultScreenshotA = screenshotUrl;
      match.scoreAByCapA = scoreA;
      match.scoreBByCapA = scoreB;
    } else {
      match.resultScreenshotB = screenshotUrl;
      match.scoreAByCapB = scoreA;
      match.scoreBByCapB = scoreB;
    }

    if (!match.resultConfirmedBy.includes(userId)) {
      match.resultConfirmedBy = [...match.resultConfirmedBy, userId];
    }

    // Mark when the FIRST result was submitted (to track the 10-min deadline)
    if (!match.firstResultAt) {
      match.firstResultAt = new Date();
      // Server-side fallback: if the second captain never submits and nobody
      // is polling the match page, escalate automatically after 10 min.
      const matchIdForTimer = match.id;
      setTimeout(async () => {
        try {
          await this.expireResult(matchIdForTimer);
        } catch {}
      }, 10 * 60 * 1000 + 5000); // +5s buffer
    }

    // Both captains submitted — compare scores
    if (match.resultScreenshotA && match.resultScreenshotB) {
      const scoresMatch =
        match.scoreAByCapA === match.scoreAByCapB &&
        match.scoreBByCapA === match.scoreBByCapB;

      // Победитель по версии каждого капитана
      const winnerOf = (a?: number | null, b?: number | null): 'A' | 'B' | null =>
        (a ?? 0) > (b ?? 0) ? 'A' : (b ?? 0) > (a ?? 0) ? 'B' : null;
      const winnerByCapA = winnerOf(match.scoreAByCapA, match.scoreBByCapA);
      const winnerByCapB = winnerOf(match.scoreAByCapB, match.scoreBByCapB);

      let resolved = false;
      if (scoresMatch) {
        match.scoreA = match.scoreAByCapA;
        match.scoreB = match.scoreBByCapA;
        match.isDisputed = false;
        resolved = true;
      } else if (winnerByCapA && winnerByCapA === winnerByCapB) {
        // Счёт расходится, но оба согласны КТО победил →
        // засчитываем счёт, который указал капитан ПОБЕДИВШЕЙ команды.
        if (winnerByCapA === 'A') { match.scoreA = match.scoreAByCapA; match.scoreB = match.scoreBByCapA; }
        else { match.scoreA = match.scoreAByCapB; match.scoreB = match.scoreBByCapB; }
        match.isDisputed = false;
        resolved = true;
      } else {
        // Настоящий спор (оба заявляют победу/ничью) — решает админ
        match.isDisputed = true;
      }

      // ── Клановый бой: при разрешённом счёте засчитываем сразу (без админа/KD) ──
      if (match.isClanMatch && match.clanMode === 'battle' && resolved) {
        match.winnerTeam = (match.scoreA ?? 0) > (match.scoreB ?? 0) ? 'A' : 'B';
        match.status = MatchStatus.COMPLETED;
        match.endedAt = new Date();
        const savedC = await this.matchRepo.save(match);
        await this.finalizeClanBattle(savedC);
        this.gateway.emitToMatch(matchId, 'match_updated', savedC);
        return savedC;
      }

      match.status = MatchStatus.RESULT_PENDING;
      const saved = await this.matchRepo.save(match);
      this.gateway.emitToMatch(matchId, 'match_updated', saved);
      await this.sendResultToAdmin(saved);
      return saved;
    }

    const saved = await this.matchRepo.save(match);
    this.gateway.emitToMatch(matchId, 'match_updated', saved);
    return saved;
  }

  /**
   * Called by frontend when 10-min deadline passed and second captain never submitted.
   * Escalates to RESULT_PENDING with just one screenshot so admin can manually verify.
   */
  async expireResult(matchId: number): Promise<Match> {
    const match = await this.getMatch(matchId);
    if (match.status !== MatchStatus.IN_PROGRESS) return match;

    // Only act if exactly one captain submitted and deadline passed
    const onlyA = !!match.resultScreenshotA && !match.resultScreenshotB;
    const onlyB = !match.resultScreenshotA && !!match.resultScreenshotB;
    if (!onlyA && !onlyB) return match;

    if (!match.firstResultAt) return match;
    const DEADLINE_MS = 10 * 60 * 1000;
    if (Date.now() - new Date(match.firstResultAt).getTime() < DEADLINE_MS) return match;

    // Use the submitted scores as final, mark as needing admin review
    if (onlyA) {
      match.scoreA = match.scoreAByCapA ?? 0;
      match.scoreB = match.scoreBByCapA ?? 0;
    } else {
      match.scoreA = match.scoreAByCapB ?? 0;
      match.scoreB = match.scoreBByCapB ?? 0;
    }

    match.isDisputed = true; // force admin review
    match.status = MatchStatus.RESULT_PENDING;
    const saved = await this.matchRepo.save(match);
    this.gateway.emitToMatch(matchId, 'match_updated', saved);

    await this.sendMissingResultToAdmin(saved, onlyA ? 'A' : 'B');
    return saved;
  }

  // ── Telegram → админ-чат ───────────────────────────────────────────────────
  private get tgConfig() {
    return {
      botToken: process.env.BOT_TOKEN,
      chatId: process.env.ADMIN_CHAT_ID,
      topicId: process.env.TOPIC_MATCHES ? parseInt(process.env.TOPIC_MATCHES) : undefined,
    };
  }

  /** Текстовое сообщение в админ-чат (с таймаутом и логом ошибки). */
  private async tgSendMessage(text: string, matchId?: number): Promise<boolean> {
    const { botToken, chatId, topicId } = this.tgConfig;
    if (!botToken || !chatId) { this.logger.warn('TG admin chat: BOT_TOKEN/ADMIN_CHAT_ID не заданы'); return false; }
    const reply_markup = matchId ? {
      inline_keyboard: [[
        { text: '🔵 Победа A', callback_data: `result_A_${matchId}` },
        { text: '🔴 Победа B', callback_data: `result_B_${matchId}` },
        { text: '🤝 Ничья', callback_data: `result_draw_${matchId}` },
      ]],
    } : undefined;
    try {
      await tgPost('sendMessage', {
        chat_id: chatId, text, parse_mode: 'HTML',
        ...(topicId ? { message_thread_id: topicId } : {}),
        ...(reply_markup ? { reply_markup } : {}),
      });
      return true;
    } catch (e: any) {
      this.logger.warn(`TG sendMessage failed: ${e?.response?.data?.description || e?.message}`);
      return false;
    }
  }

  /** Скриншот в админ-чат: грузим ФАЙЛОМ с диска (надёжнее, чем photo по URL). */
  private async tgSendScreenshot(relPath: string, caption: string): Promise<void> {
    const { botToken, chatId, topicId } = this.tgConfig;
    if (!botToken || !chatId || !relPath) return;
    const abs = join(process.cwd(), relPath.replace(/^\//, ''));
    try {
      if (existsSync(abs)) {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', caption);
        if (topicId) form.append('message_thread_id', String(topicId));
        form.append('photo', createReadStream(abs));
        await tgPost('sendPhoto', form, {
          headers: form.getHeaders(), timeout: 25000, maxBodyLength: Infinity,
        });
      } else {
        // файла нет на диске — отправим ссылку текстом
        const url = relPath.startsWith('http') ? relPath : `${process.env.PUBLIC_URL || ''}${relPath}`;
        await this.tgSendMessage(`${caption}\n${url}`);
      }
    } catch (e: any) {
      this.logger.warn(`TG sendPhoto failed: ${e?.response?.data?.description || e?.message}`);
    }
  }

  private async sendMissingResultToAdmin(match: Match, submittedBy: 'A' | 'B'): Promise<void> {
    const missing = submittedBy === 'A' ? 'B' : 'A';
    const screenshot = submittedBy === 'A' ? match.resultScreenshotA : match.resultScreenshotB;
    const scoreA = submittedBy === 'A' ? match.scoreAByCapA : match.scoreAByCapB;
    const scoreB = submittedBy === 'A' ? match.scoreBByCapA : match.scoreBByCapB;

    const text =
      `⏰ <b>Истёк дедлайн — Матч #${match.id}</b>\n\n` +
      `🗺 Карта: <b>${match.map}</b>\n` +
      `📊 Счёт от капитана ${submittedBy}: <b>${scoreA} : ${scoreB}</b>\n\n` +
      `❌ Капитан команды <b>${missing}</b> так и не загрузил результат.\n` +
      `Проверьте скриншот и подтвердите победителя вручную:`;

    await this.tgSendMessage(text, match.id);
    if (screenshot) await this.tgSendScreenshot(screenshot, `📸 Скрин капитана ${submittedBy} (${scoreA}:${scoreB})`);
  }

  private async sendResultToAdmin(match: Match): Promise<void> {
    let text: string;
    if (match.isDisputed) {
      text =
        `⚠️ <b>СПОРНЫЙ РЕЗУЛЬТАТ — Матч #${match.id}</b>\n\n` +
        `🗺 Карта: <b>${match.map}</b>\n\n` +
        `📊 Счёт от капитана A: <b>${match.scoreAByCapA} : ${match.scoreBByCapA}</b>\n` +
        `📊 Счёт от капитана B: <b>${match.scoreAByCapB} : ${match.scoreBByCapB}</b>\n\n` +
        `❗ Счета не совпадают. Проверьте скриншоты и выберите победителя вручную:`;
    } else {
      text =
        `✅ <b>Результаты матча #${match.id}</b>\n\n` +
        `🗺 Карта: <b>${match.map}</b>\n` +
        `📊 Счёт: <b>${match.scoreA} : ${match.scoreB}</b>\n` +
        `🤝 Оба капитана подтвердили результат\n\n` +
        `Подтвердите победителя:`;
    }

    await this.tgSendMessage(text, match.id);
    if (match.resultScreenshotA) {
      await this.tgSendScreenshot(match.resultScreenshotA, match.isDisputed ? `📸 Скрин капитана A (${match.scoreAByCapA}:${match.scoreBByCapA})` : `📸 Скрин команды A`);
    }
    if (match.resultScreenshotB) {
      await this.tgSendScreenshot(match.resultScreenshotB, match.isDisputed ? `📸 Скрин капитана B (${match.scoreAByCapB}:${match.scoreBByCapB})` : `📸 Скрин команды B`);
    }
  }

  async confirmResult(matchId: number, adminId: number, winner: 'A' | 'B' | 'draw'): Promise<Match> {
    const match = await this.getMatch(matchId);
    match.winnerTeam = winner;
    match.status = MatchStatus.COMPLETED;
    match.endedAt = new Date();

    // Клановый бой: применяем рейтинг клана сразу (KD/личный ELO не считаем).
    if (match.isClanMatch && match.clanMode === 'battle') {
      if (winner !== 'draw') {
        // согласуем счёт с решением админа, чтобы победитель совпадал
        const a = match.scoreA ?? 0, b = match.scoreB ?? 0;
        if (winner === 'A' && !(a > b)) { match.scoreA = Math.max(a, b + 1); }
        if (winner === 'B' && !(b > a)) { match.scoreB = Math.max(b, a + 1); }
      }
      const savedClan = await this.matchRepo.save(match);
      await this.finalizeClanBattle(savedClan);
      this.gateway.emitToMatch(matchId, 'match_updated', savedClan);
      this.discordService.deleteMatchVoiceRooms(match.voiceChannelTId, match.voiceChannelCTId).catch(() => {});
      return savedClan;
    }

    // ELO / stats applied only after moderator submits KD
    const saved = await this.matchRepo.save(match);
    this.gateway.emitToMatch(matchId, 'match_updated', saved);

    // Clean up Discord voice rooms
    this.discordService
      .deleteMatchVoiceRooms(match.voiceChannelTId, match.voiceChannelCTId)
      .catch(() => {});

    return saved;
  }

  /**
   * Returns any active match the user is currently in
   * (ready_check, map_veto, in_progress, result_pending).
   * Used on app start to redirect players back to their match.
   */
  async getMyActiveMatch(userId: number): Promise<{ matchId: number } | null> {
    const matches = await this.matchRepo
      .createQueryBuilder('m')
      .where('m.status IN (:...statuses)', {
        statuses: [MatchStatus.READY_CHECK, MatchStatus.MAP_VETO, MatchStatus.IN_PROGRESS, MatchStatus.RESULT_PENDING],
      })
      .andWhere('(:userId = ANY(m.team_a_ids) OR :userId = ANY(m.team_b_ids))', { userId })
      .orderBy('m.created_at', 'DESC')
      .getMany();

    for (const m of matches) {
      // RESULT_PENDING — решает админ, игроки свободны
      if (m.status === MatchStatus.RESULT_PENDING) continue;
      const isA = m.teamAIds.includes(userId);
      const mySubmitted = isA ? !!m.resultScreenshotA : !!m.resultScreenshotB;
      if (mySubmitted) continue; // своя команда загрузила — свободен
      const aSub = !!m.resultScreenshotA, bSub = !!m.resultScreenshotB;
      if (aSub || bSub) {
        // соперник загрузил: обязан остаться только капитан незагрузившей команды
        const pendingCaptain = aSub && !bSub ? m.captainBId : m.captainAId;
        if (userId === pendingCaptain) return { matchId: m.id };
        continue; // остальные свободны
      }
      // никто ещё не загрузил → игрок остаётся в матче
      return { matchId: m.id };
    }
    return null;
  }

  async getMatch(id: number): Promise<Match> {
    const match = await this.matchRepo.findOne({ where: { id } });
    if (!match) throw new NotFoundException(`Match ${id} not found`);
    return match;
  }

  /**
   * Public fetch used by frontend polling — auto-escalates if result deadline passed.
   * This ensures the match gets processed even if a captain leaves the page.
   */
  async fetchMatchForClient(id: number): Promise<Match> {
    const match = await this.getMatch(id);
    await this.checkAndEscalateResultDeadline(match);
    // Дозагрузка голосовых комнат, если они не создались при старте матча
    // (бот Discord мог быть не готов). Создастся при первом поллинге.
    if (match.status === MatchStatus.IN_PROGRESS && !match.isClanMatch && !match.voiceChannelTId) {
      this.createVoiceRoomsInBackground(id).catch(() => {});
    }
    // Невход в лобби (5 мин) — отменяем матч даже после рестарта сервера
    if (match.status === MatchStatus.IN_PROGRESS && match.lobbyLinkPublishedAt) {
      const elapsed = Date.now() - new Date(match.lobbyLinkPublishedAt).getTime();
      const allJoined = [...new Set([...match.teamAIds, ...match.teamBIds])].every(uid => match.lobbyJoinedPlayers.includes(uid));
      if (elapsed >= 5 * 60 * 1000 && !allJoined) {
        await this.penalizeLobbyDodgers(id).catch(() => {});
      }
    }
    // Return fresh state in case it was escalated
    return this.getMatch(id);
  }

  private async checkAndEscalateResultDeadline(match: Match): Promise<void> {
    if (match.status !== MatchStatus.IN_PROGRESS) return;
    if (!match.firstResultAt) return;

    const onlyA = !!match.resultScreenshotA && !match.resultScreenshotB;
    const onlyB = !match.resultScreenshotA && !!match.resultScreenshotB;
    if (!onlyA && !onlyB) return;

    const DEADLINE_MS = 10 * 60 * 1000;
    if (Date.now() - new Date(match.firstResultAt).getTime() < DEADLINE_MS) return;

    // Deadline passed — escalate (same logic as expireResult)
    await this.expireResult(match.id);
  }

  private readonly LOBBY_LINK_RE = /^https:\/\/link\.standoff2\.com\/.+\/lobby\/join\/.+/i;

  async setLobbyLink(matchId: number, userId: number, link: string): Promise<Match> {
    const match = await this.getMatch(matchId);
    if (match.hostId !== userId) throw new BadRequestException('Только хост может установить ссылку на лобби');
    if (match.status !== MatchStatus.IN_PROGRESS) throw new BadRequestException('Матч не в процессе');

    const trimmed = link.trim();
    if (!this.LOBBY_LINK_RE.test(trimmed)) {
      throw new BadRequestException('Вставьте ссылку на лобби Standoff 2 (link.standoff2.com/…/lobby/join/…)');
    }

    // Если ссылка уже была опубликована — это «изменение». Разрешено только один раз.
    if (match.lobbyLink) {
      if (match.lobbyLinkChanged) {
        throw new BadRequestException('Ссылку можно изменить только один раз');
      }
      match.lobbyLinkChanged = true;
    }

    match.lobbyLink = trimmed;
    // Reset join tracking; host is auto-confirmed since they created the lobby
    match.lobbyJoinedPlayers = [userId];
    match.lobbyLinkPublishedAt = new Date();
    const saved = await this.matchRepo.save(match);
    this.gateway.emitToMatch(matchId, 'match_updated', saved);

    // Server-side timer: after 5 min ban players who never clicked
    const JOIN_WINDOW_MS = 5 * 60 * 1000;
    setTimeout(async () => {
      try {
        await this.penalizeLobbyDodgers(matchId);
      } catch {}
    }, JOIN_WINDOW_MS + 5000);

    return saved;
  }

  /** Mark player as having joined the lobby (clicked the link). */
  async confirmLobbyJoin(matchId: number, userId: number): Promise<Match> {
    const match = await this.getMatch(matchId);
    if (match.status !== MatchStatus.IN_PROGRESS) return match;
    if (!match.lobbyLink) return match;
    if (match.lobbyJoinedPlayers.includes(userId)) return match;

    match.lobbyJoinedPlayers = [...match.lobbyJoinedPlayers, userId];
    const saved = await this.matchRepo.save(match);
    this.gateway.emitToMatch(matchId, 'match_updated', saved);
    return saved;
  }

  /**
   * Если кто-то не зашёл по ссылке лобби за 5 минут — баним додж(еров) на 30 минут
   * И ОТМЕНЯЕМ матч. Восстанавливаемо при рестарте: дёргается и по таймеру, и при
   * поллинге клиентом (fetchMatchForClient).
   */
  private async penalizeLobbyDodgers(matchId: number): Promise<void> {
    const match = await this.getMatch(matchId);
    if (match.status !== MatchStatus.IN_PROGRESS) return;
    if (!match.lobbyLinkPublishedAt) return;

    const elapsed = Date.now() - new Date(match.lobbyLinkPublishedAt).getTime();
    if (elapsed < 5 * 60 * 1000) return; // окно ещё не вышло

    const allPlayers = [...new Set([...match.teamAIds, ...match.teamBIds])];
    const dodgers = allPlayers.filter(id => !match.lobbyJoinedPlayers.includes(id));
    if (dodgers.length === 0) return; // все зашли — ничего не делаем

    // Штрафуем тех, кто не зашёл
    for (const uid of dodgers) {
      const user = await this.userRepo.findOne({ where: { id: uid } });
      if (!user) continue;
      user.cooldownUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min ban
      await this.userRepo.save(user);
      await this.notifRepo.save(
        this.notifRepo.create({
          userId: uid, type: 'penalty',
          title: '🚫 Штраф: не зашёл в лобби',
          body: 'Вы не перешли по ссылке лобби за 5 минут. Матч отменён. Кулдаун 30 минут.',
          meta: { type: 'lobby_dodge' },
        }),
      );
    }

    // Отменяем матч
    match.status = MatchStatus.CANCELLED;
    match.endedAt = new Date();
    const saved = await this.matchRepo.save(match);
    this.gateway.emitToMatch(matchId, 'match_updated', saved);
    this.discordService.deleteMatchVoiceRooms(match.voiceChannelTId, match.voiceChannelCTId).catch(() => {});

    // Уведомляем остальных, что матч отменён
    const others = allPlayers.filter(id => !dodgers.includes(id));
    for (const uid of others) {
      await this.notifRepo.save(this.notifRepo.create({
        userId: uid, type: 'match',
        title: 'Матч отменён',
        body: 'Один из игроков не зашёл в лобби за 5 минут. Матч отменён.',
        meta: { type: 'lobby_dodge_cancel', matchId },
      }));
    }
  }

  /**
   * Хост не выложил ссылку на лобби за 5 минут после старта матча.
   * → хост получает временный бан за додж (как при невходе в лобби), матч отменяется.
   * Вызывается клиентами по таймеру.
   */
  async expireLobbyLink(matchId: number): Promise<Match> {
    const match = await this.getMatch(matchId);
    if (match.status !== MatchStatus.IN_PROGRESS) return match;
    if (match.lobbyLink) return match; // ссылка уже есть — ничего не делаем
    if (!match.startedAt) return match;
    const elapsed = Date.now() - new Date(match.startedAt).getTime();
    if (elapsed < 5 * 60 * 1000) return match; // ещё рано

    // Штраф хосту — такой же кулдаун, как за невход в лобби (30 минут)
    const host = await this.userRepo.findOne({ where: { id: match.hostId } });
    if (host) {
      host.cooldownUntil = new Date(Date.now() + 30 * 60 * 1000);
      await this.userRepo.save(host);
      await this.notifRepo.save(
        this.notifRepo.create({
          userId: host.id,
          type: 'penalty',
          title: '🚫 Штраф: не выложена ссылка на лобби',
          body: 'Вы не опубликовали ссылку на лобби за 5 минут. Матч отменён. Кулдаун 30 минут.',
          meta: { type: 'lobby_link_dodge' },
        }),
      );
    }

    match.status = MatchStatus.CANCELLED;
    match.endedAt = new Date();
    const saved = await this.matchRepo.save(match);
    this.gateway.emitToMatch(matchId, 'match_updated', saved);
    this.discordService
      .deleteMatchVoiceRooms(match.voiceChannelTId, match.voiceChannelCTId)
      .catch(() => {});
    return saved;
  }

  async getMatchHistory(userId: number, page = 1, limit = 10, league: string | null = null) {
    const skip = (page - 1) * limit;

    const allPlayerRows = await this.playerRepo.find({ where: { userId } });
    if (!allPlayerRows.length) return { matches: [], total: 0, page, limit };

    const allMatchIds = [...new Set(allPlayerRows.map((p) => p.matchId))];
    const completedMatchesRaw = await this.matchRepo.findBy({
      id: In(allMatchIds),
      status: MatchStatus.COMPLETED,
    });
    // История ведётся отдельно по лигам: league=null → обычные (без клана/лиги),
    // league='cpl'|'cplq' → только матчи соответствующей лиги.
    const completedMatches = completedMatchesRaw.filter((m) => league ? m.league === league : (!m.isClanMatch && !m.league));
    const matchMap = Object.fromEntries(completedMatches.map((m) => [m.id, m]));
    const completedIds = new Set(completedMatches.map((m) => m.id));

    // Схлопываем возможные дубли строк одного матча (легаси-баг createMatchPlayers):
    // мерджим стату и ELO, чтобы матч был ОДИН.
    const byMatch = new Map<number, any[]>();
    for (const r of allPlayerRows) {
      if (!completedIds.has(r.matchId)) continue;
      const arr = byMatch.get(r.matchId) ?? [];
      arr.push(r);
      byMatch.set(r.matchId, arr);
    }

    // Берём значение с наибольшим модулем (реальная строка vs нулевой дубль;
    // корректно для отрицательного eloChange)
    const pick = (rows: any[], f: string): number =>
      rows.reduce((acc, r) => (Math.abs(Number(r[f] ?? 0)) > Math.abs(acc) ? Number(r[f] ?? 0) : acc), 0);

    const merged = [...byMatch.entries()].map(([matchId, rows]) => {
      const m = matchMap[matchId];
      const isTeamA = m.teamAIds.includes(userId);
      const won = (isTeamA && m.winnerTeam === 'A') || (!isTeamA && m.winnerTeam === 'B');
      const createdAt = rows.reduce(
        (a, r) => (new Date(r.createdAt) < new Date(a) ? r.createdAt : a),
        rows[0].createdAt,
      );
      return {
        matchId:     m.id,
        map:         m.map ?? null,
        status:      m.status,
        winner:      m.winnerTeam,
        result:      m.winnerTeam === 'draw' ? 'draw' : won ? 'win' : 'loss',
        team:        isTeamA ? 'A' : 'B',
        scoreMy:     isTeamA ? (m.scoreA ?? 0) : (m.scoreB ?? 0),
        scoreOpp:    isTeamA ? (m.scoreB ?? 0) : (m.scoreA ?? 0),
        totalRounds: m.totalRounds ?? 0,
        createdAt,
        eloChange:   pick(rows, 'eloChange'),
        eloAfter:    pick(rows, 'eloAfter'),
        kills:       pick(rows, 'kills'),
        deaths:      pick(rows, 'deaths'),
        assists:     pick(rows, 'assists'),
        kdMatch:     pick(rows, 'kdMatch'),
        kprMatch:    pick(rows, 'kprMatch'),
        aprMatch:    pick(rows, 'aprMatch'),
        srMatch:     pick(rows, 'srMatch'),
        ratingMatch: pick(rows, 'ratingMatch'),
        kdSubmitted: m.kdSubmitted,
      };
    });

    // Помечаем калибровочные матчи: первые 10 (хронологически) у игрока.
    // Для них в истории скрываем изменение ELO (показываем «?»).
    [...merged]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((m, i) => { (m as any).calibration = i < 10; });

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = merged.length;
    return { matches: merged.slice(skip, skip + limit), total, page, limit };
  }

  // ── Статистика игрока по картам (winrate / средний рейтинг) ────────────────
  async getMapStats(userId: number, league: string | null = null) {
    const rows = await this.playerRepo.find({ where: { userId } });
    const matchIds = [...new Set(rows.map((r) => r.matchId))];
    const matches = matchIds.length
      ? await this.matchRepo.findBy({ id: In(matchIds) })
      : [];
    const mMap = new Map<number, Match>();
    for (const m of matches) {
      // Карт-стата ведётся отдельно по лигам (league=null → обычные).
      if (m.status !== MatchStatus.COMPLETED) continue;
      if (league ? m.league === league : (!m.isClanMatch && !m.league)) mMap.set(m.id, m);
    }

    const byMatch = new Map<number, MatchPlayer[]>();
    for (const r of rows) {
      if (!mMap.has(r.matchId)) continue;
      const arr = byMatch.get(r.matchId) ?? [];
      arr.push(r);
      byMatch.set(r.matchId, arr);
    }
    const pick = (arr: MatchPlayer[], f: keyof MatchPlayer): number =>
      arr.reduce((acc, r) => (Math.abs(Number(r[f] ?? 0)) > Math.abs(acc) ? Number(r[f] ?? 0) : acc), 0);

    const acc: Record<string, { played: number; wins: number; losses: number; ratingSum: number; killsSum: number; rated: number }> = {};
    for (const map of MAPS) acc[map] = { played: 0, wins: 0, losses: 0, ratingSum: 0, killsSum: 0, rated: 0 };

    for (const [mid, arr] of byMatch) {
      const m = mMap.get(mid)!;
      const map = (m.map || '').toUpperCase();
      const s = acc[map];
      if (!s) continue;
      s.played += 1;
      const isTeamA = m.teamAIds.includes(userId);
      if (m.winnerTeam === 'draw') {
        /* ничья */
      } else if ((isTeamA && m.winnerTeam === 'A') || (!isTeamA && m.winnerTeam === 'B')) {
        s.wins += 1;
      } else if (m.winnerTeam === 'A' || m.winnerTeam === 'B') {
        s.losses += 1;
      }
      const rating = pick(arr, 'ratingMatch');
      if (m.kdSubmitted && rating > 0) {
        s.ratingSum += rating;
        s.killsSum += pick(arr, 'kills');
        s.rated += 1;
      }
    }

    return MAPS.map((map) => {
      const s = acc[map];
      const decided = s.wins + s.losses;
      return {
        map,
        played: s.played,
        wins: s.wins,
        losses: s.losses,
        winRate: decided > 0 ? Math.round((s.wins / decided) * 1000) / 10 : 0,
        avgRating: s.rated > 0 ? Math.round((s.ratingSum / s.rated) * 100) / 100 : 0,
        avgKills: s.rated > 0 ? Math.round((s.killsSum / s.rated) * 10) / 10 : 0,
      };
    });
  }

  // ── Полная сводка завершённого матча (обе команды, статы, MVP) ─────────────
  async getMatchSummary(matchId: number) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match || match.status !== MatchStatus.COMPLETED) {
      throw new NotFoundException('Матч не найден');
    }

    const rows = await this.playerRepo.find({ where: { matchId } });
    // Легаси-дубли: данные одного игрока могут быть расщеплены по нескольким
    // строкам (в одной eloChange, в другой kills/rating). Поэтому собираем
    // КАЖДОЕ поле отдельно — берём значение с наибольшим модулем по всем строкам
    // игрока (как в getMatchHistory), а не одну «лучшую» строку целиком.
    const byUser = new Map<number, MatchPlayer[]>();
    for (const r of rows) {
      const arr = byUser.get(r.userId) ?? [];
      arr.push(r);
      byUser.set(r.userId, arr);
    }
    const pick = (arr: MatchPlayer[] | undefined, f: keyof MatchPlayer): number =>
      (arr ?? []).reduce(
        (acc, r) => (Math.abs(Number(r[f] ?? 0)) > Math.abs(acc) ? Number(r[f] ?? 0) : acc),
        0,
      );

    const dedup = (arr: number[]) => [...new Set(arr)].filter(Boolean);
    const teamAIds = dedup(match.teamAIds);
    const teamBIds = dedup(match.teamBIds);
    const allIds = [...new Set([...teamAIds, ...teamBIds])];
    const users = allIds.length ? await this.userRepo.findBy({ id: In(allIds) }) : [];
    const uMap = Object.fromEntries(users.map((u) => [u.id, u]));

    // Калибровочный матч для игрока = он среди его первых 10 сыгранных.
    // Считаем число матчей игрока на момент этого матча (включительно).
    const calMap: Record<number, boolean> = {};
    if (allIds.length) {
      const counts = await this.playerRepo
        .createQueryBuilder('mp')
        .select('mp.user_id', 'uid')
        .addSelect('COUNT(DISTINCT mp.match_id)', 'cnt')
        .where('mp.user_id IN (:...ids)', { ids: allIds })
        .andWhere('mp.created_at <= :ts', { ts: match.createdAt })
        .groupBy('mp.user_id')
        .getRawMany();
      for (const c of counts) calMap[Number(c.uid)] = Number(c.cnt) <= 10;
    }

    const buildPlayer = (uid: number) => {
      const u: User | undefined = uMap[uid];
      const p = byUser.get(uid);
      return {
        userId: uid,
        nickname: u?.gameNickname || u?.firstName || `Игрок ${uid}`,
        avatarUrl: u?.avatarUrl ?? null,
        elo: u?.elo ?? 1000,
        region: u?.region ?? null,
        isVerified: u?.isVerified ?? false,
        isAdmin: u?.isAdmin ?? false,
        kills: pick(p, 'kills'),
        deaths: pick(p, 'deaths'),
        assists: pick(p, 'assists'),
        kdMatch: pick(p, 'kdMatch'),
        kprMatch: pick(p, 'kprMatch'),
        aprMatch: pick(p, 'aprMatch'),
        srMatch: pick(p, 'srMatch'),
        ratingMatch: pick(p, 'ratingMatch'),
        eloChange: pick(p, 'eloChange'),
        eloAfter: pick(p, 'eloAfter'),
        calibration: calMap[uid] ?? false,
      };
    };

    const teamA = teamAIds.map(buildPlayer);
    const teamB = teamBIds.map(buildPlayer);

    // MVP — наибольший rating среди всех (только если статистика внесена)
    let mvpUserId: number | null = null;
    if (match.kdSubmitted) {
      const all = [...teamA, ...teamB];
      const best = all.reduce<any>(
        (acc, p) => (p.ratingMatch > (acc?.ratingMatch ?? -Infinity) ? p : acc),
        null,
      );
      if (best && best.ratingMatch > 0) mvpUserId = best.userId;
    }

    const teamASide = match.teamASide ?? null;
    const teamBSide = teamASide ? (teamASide === 'T' ? 'CT' : 'T') : null;

    return {
      id: match.id,
      map: match.map ?? null,
      status: match.status,
      winnerTeam: match.winnerTeam,
      scoreA: match.scoreA ?? 0,
      scoreB: match.scoreB ?? 0,
      totalRounds: match.totalRounds ?? 0,
      isDisputed: match.isDisputed,
      kdSubmitted: match.kdSubmitted,
      teamASide,
      teamBSide,
      createdAt: match.createdAt,
      mvpUserId,
      teamA,
      teamB,
    };
  }

  // ── Чат матча (обе команды) ────────────────────────────────────────────────
  private participantTeam(match: Match, userId: number): 'A' | 'B' | null {
    if ((match.teamAIds || []).includes(userId)) return 'A';
    if ((match.teamBIds || []).includes(userId)) return 'B';
    return null;
  }

  async getMatchMessages(matchId: number, userId: number) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Матч не найден');
    if (!this.participantTeam(match, userId)) throw new BadRequestException('Вы не участник этого матча');
    return this.msgRepo.find({ where: { matchId }, order: { id: 'ASC' }, take: 300 });
  }

  async sendMatchMessage(matchId: number, userId: number, text: string) {
    const clean = (text || '').trim().slice(0, 500);
    if (!clean) throw new BadRequestException('Пустое сообщение');
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Матч не найден');
    const team = this.participantTeam(match, userId);
    if (!team) throw new BadRequestException('Вы не участник этого матча');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const msg = await this.msgRepo.save(this.msgRepo.create({
      matchId,
      userId,
      team,
      nickname: user?.gameNickname || user?.firstName || 'Игрок',
      avatarUrl: user?.avatarUrl || null,
      text: clean,
    }));
    this.gateway.emitToMatch(matchId, 'match_message', msg);
    return msg;
  }
}
