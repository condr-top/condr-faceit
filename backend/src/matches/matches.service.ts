import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios from 'axios';
import { Match, MatchStatus, MAPS } from './entities/match.entity';
import { MatchPlayer } from './entities/match-player.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AppGateway } from '../gateway/app.gateway';
import { DiscordService, MatchTeams } from '../discord/discord.service';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(MatchPlayer) private playerRepo: Repository<MatchPlayer>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    private gateway: AppGateway,
    private discordService: DiscordService,
  ) {}

  // ── 2v2 Lobby helpers ─────────────────────────────────────────────────────

  /** Find the READY_CHECK 2v2 lobby this user is currently in (if any). */
  private async findUser2v2Lobby(userId: number): Promise<Match | null> {
    const openMatches = await this.matchRepo.find({ where: { status: MatchStatus.READY_CHECK } });
    return (
      openMatches.find(
        (m) =>
          m.teamAIds.length + m.teamBIds.length === 4 &&
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
  async joinOrCreateLobby2v2(userId: number): Promise<Match> {
    const userCheck = await this.userRepo.findOne({ where: { id: userId } });
    if (userCheck?.isBanned) throw new BadRequestException('Ваш аккаунт заблокирован');

    // Already in a lobby → return it
    const existing = await this.findUser2v2Lobby(userId);
    if (existing) {
      this.gateway.emitMatchFound([userId], existing.id);
      return existing;
    }

    // Look for any open lobby with free slots that we can join
    const openMatches = await this.matchRepo.find({ where: { status: MatchStatus.READY_CHECK } });
    const joinable = openMatches.find(
      (m) =>
        m.teamAIds.length + m.teamBIds.length === 4 &&
        ![...m.teamAIds, ...m.teamBIds].includes(userId) &&
        this.lobbyPlaceholders(m) > 0,
    );

    if (joinable) {
      return this.fillLobbySlot(joinable, userId);
    }

    // No open lobby → create a fresh one
    return this.createLobby2v2(userId);
  }

  /** Create a brand-new 2v2 lobby for userId. */
  async createLobby2v2(userId: number): Promise<Match> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const match = this.matchRepo.create({
      status: MatchStatus.READY_CHECK,
      teamAIds: [userId, userId], // creator fills all slots as placeholders initially
      teamBIds: [userId, userId],
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

    if (match.readyPlayers.length >= uniquePlayers.size) {
      // ── ELO-balanced team distribution ──
      const playerIds = [...uniquePlayers];
      const users = await this.userRepo.findBy({ id: In(playerIds) });
      const eloMap = Object.fromEntries(users.map((u) => [u.id, u.elo]));

      // Sort by ELO descending: [best, 2nd, 3rd, worst]
      const sorted = [...playerIds].sort((a, b) => (eloMap[b] ?? 0) - (eloMap[a] ?? 0));

      // Snake draft: pair (1st+4th) vs (2nd+3rd) — most balanced split
      // Randomly decide which balanced pair goes to team A / team B
      const pairOne = [sorted[0], sorted[sorted.length - 1]];
      const pairTwo = sorted.slice(1, sorted.length - 1);
      const [teamA, teamB] = Math.random() < 0.5 ? [pairOne, pairTwo] : [pairTwo, pairOne];

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
    const isLobbyFull = uniquePlayers.length === 4;

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
  private async applyDodgePenalty(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;
    const before = user.elo;
    user.elo = Math.max(100, user.elo - 10);
    await this.matchRepo.query(
      `INSERT INTO elo_history(user_id,elo_before,elo_after,elo_change,reason) VALUES($1,$2,$3,$4,'dodge_penalty')`,
      [userId, before, user.elo, user.elo - before],
    );
    const until = new Date(Date.now() + 90_000); // 90 seconds = 1.5 min
    user.cooldownUntil = until;
    await this.userRepo.save(user);

    await this.notifRepo.save(
      this.notifRepo.create({
        userId,
        type: 'penalty',
        title: '⏱️ Штраф: пропуск ready check',
        body: 'Вы не приняли ready check. -10 ELO, кулдаун 1.5 минуты.',
        meta: { type: 'dodge', eloPenalty: -10 },
      }),
    );
  }

  async vetoMap(matchId: number, userId: number, mapName: string): Promise<Match> {
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

    match.availableMaps = match.availableMaps.filter((m) => m !== mapName);
    match.vetoPhase += 1;

    if (match.availableMaps.length === 1) {
      match.map = match.availableMaps[0];
      match.status = MatchStatus.IN_PROGRESS;
      match.startedAt = new Date();
      // ── Random side assignment ──
      match.teamASide = Math.random() < 0.5 ? 'T' : 'CT';
      await this.createMatchPlayers(match);

      // ── Create Discord voice rooms ──
      // Fetch Discord usernames for role assignment
      const allIds    = [...match.teamAIds, ...match.teamBIds];
      const allUsers  = await this.userRepo.findBy({ id: In(allIds) });
      const userMap   = new Map(allUsers.map(u => [u.id, u.discordUsername ?? '']));

      const teamASide = match.teamASide;
      const teamADiscord = match.teamAIds.map(id => userMap.get(id) ?? '').filter(Boolean);
      const teamBDiscord = match.teamBIds.map(id => userMap.get(id) ?? '').filter(Boolean);

      const teams = {
        matchId: match.id,
        teamT:  teamASide === 'T' ? teamADiscord : teamBDiscord,
        teamCT: teamASide === 'CT' ? teamADiscord : teamBDiscord,
      };

      const rooms = await this.discordService.createMatchVoiceRooms(match.id, 2, teams);
      if (rooms) {
        match.voiceChannelTId  = rooms.channelTId;
        match.voiceChannelCTId = rooms.channelCTId;
        match.voiceInviteT     = rooms.inviteT;
        match.voiceInviteCT    = rooms.inviteCT;
      }
    } else {
      match.vetoTurn = match.vetoTurn === 'A' ? 'B' : 'A';
    }

    const saved = await this.matchRepo.save(match);
    this.gateway.emitToMatch(matchId, 'match_updated', saved);
    return saved;
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

      if (scoresMatch) {
        match.scoreA = match.scoreAByCapA;
        match.scoreB = match.scoreBByCapA;
        match.isDisputed = false;
      } else {
        match.isDisputed = true;
        // Keep scoreA/scoreB empty — admin will decide
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

  private async sendMissingResultToAdmin(match: Match, submittedBy: 'A' | 'B'): Promise<void> {
    const botToken = process.env.BOT_TOKEN;
    const chatId   = process.env.ADMIN_CHAT_ID;
    const topicId  = process.env.TOPIC_MATCHES ? parseInt(process.env.TOPIC_MATCHES) : undefined;
    const ngrokUrl = process.env.PUBLIC_URL || '';
    if (!botToken || !chatId) return;

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

    try {
      const screenshotUrl = screenshot?.startsWith('http') ? screenshot : `${ngrokUrl}${screenshot}`;
      await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        chat_id: chatId,
        photo: screenshotUrl,
        caption: text,
        parse_mode: 'HTML',
        ...(topicId ? { message_thread_id: topicId } : {}),
        reply_markup: {
          inline_keyboard: [[
            { text: '🏆 Победа A', callback_data: `result_A_${match.id}` },
            { text: '🏆 Победа B', callback_data: `result_B_${match.id}` },
            { text: '🤝 Ничья',   callback_data: `result_draw_${match.id}` },
          ]],
        },
      });
    } catch {
      // Fallback: send text only
      try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          ...(topicId ? { message_thread_id: topicId } : {}),
          reply_markup: {
            inline_keyboard: [[
              { text: '🏆 Победа A', callback_data: `result_A_${match.id}` },
              { text: '🏆 Победа B', callback_data: `result_B_${match.id}` },
              { text: '🤝 Ничья',   callback_data: `result_draw_${match.id}` },
            ]],
          },
        });
      } catch {}
    }
  }

  private async sendResultToAdmin(match: Match): Promise<void> {
    const botToken = process.env.BOT_TOKEN;
    const chatId   = process.env.ADMIN_CHAT_ID;
    const topicId  = process.env.TOPIC_MATCHES ? parseInt(process.env.TOPIC_MATCHES) : undefined;
    const ngrokUrl = process.env.PUBLIC_URL || '';
    if (!botToken || !chatId) return;

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

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...(topicId ? { message_thread_id: topicId } : {}),
        reply_markup: {
          inline_keyboard: [[
            { text: '🔵 Победа A', callback_data: `result_A_${match.id}` },
            { text: '🔴 Победа B', callback_data: `result_B_${match.id}` },
            { text: '🤝 Ничья', callback_data: `result_draw_${match.id}` },
          ]],
        },
      });

      if (match.resultScreenshotA && ngrokUrl) {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          chat_id: chatId,
          photo: `${ngrokUrl}${match.resultScreenshotA}`,
          caption: match.isDisputed
            ? `📸 Скрин капитана A (указал: ${match.scoreAByCapA}:${match.scoreBByCapA})`
            : `📸 Скрин команды A`,
          ...(topicId ? { message_thread_id: topicId } : {}),
        }).catch(() => {});
      }

      if (match.resultScreenshotB && ngrokUrl) {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          chat_id: chatId,
          photo: `${ngrokUrl}${match.resultScreenshotB}`,
          caption: match.isDisputed
            ? `📸 Скрин капитана B (указал: ${match.scoreAByCapB}:${match.scoreBByCapB})`
            : `📸 Скрин команды B`,
          ...(topicId ? { message_thread_id: topicId } : {}),
        }).catch(() => {});
      }
    } catch {}
  }

  async confirmResult(matchId: number, adminId: number, winner: 'A' | 'B' | 'draw'): Promise<Match> {
    const match = await this.getMatch(matchId);
    match.winnerTeam = winner;
    match.status = MatchStatus.COMPLETED;
    match.endedAt = new Date();

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
    const active = await this.matchRepo
      .createQueryBuilder('m')
      .where('m.status IN (:...statuses)', {
        statuses: [MatchStatus.READY_CHECK, MatchStatus.MAP_VETO, MatchStatus.IN_PROGRESS, MatchStatus.RESULT_PENDING],
      })
      .andWhere('(:userId = ANY(m.team_a_ids) OR :userId = ANY(m.team_b_ids))', { userId })
      // Don't redirect back if the player's team already submitted their result
      // — they've done their part and should be free to leave
      .andWhere(`NOT (
        (:userId = ANY(m.team_a_ids) AND m.result_screenshot_a IS NOT NULL)
        OR
        (:userId = ANY(m.team_b_ids) AND m.result_screenshot_b IS NOT NULL)
      )`, { userId })
      .orderBy('m.created_at', 'DESC')
      .getOne();

    return active ? { matchId: active.id } : null;
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

  /** Ban players who didn't click the lobby link within the 5-min window. */
  private async penalizeLobbyDodgers(matchId: number): Promise<void> {
    const match = await this.getMatch(matchId);
    if (match.status !== MatchStatus.IN_PROGRESS) return;
    if (!match.lobbyLinkPublishedAt) return;

    const elapsed = Date.now() - new Date(match.lobbyLinkPublishedAt).getTime();
    if (elapsed < 4 * 60 * 1000) return; // too early — skip

    const allPlayers = [...new Set([...match.teamAIds, ...match.teamBIds])];
    const dodgers = allPlayers.filter(id => !match.lobbyJoinedPlayers.includes(id));

    for (const uid of dodgers) {
      const user = await this.userRepo.findOne({ where: { id: uid } });
      if (!user) continue;

      const until = new Date(Date.now() + 30 * 60 * 1000); // 30 min ban
      user.cooldownUntil = until;
      await this.userRepo.save(user);

      await this.notifRepo.save(
        this.notifRepo.create({
          userId: uid,
          type: 'penalty',
          title: '🚫 Штраф: не зашёл в лобби',
          body: 'Вы не перешли по ссылке лобби. Кулдаун 30 минут.',
          meta: { type: 'lobby_dodge' },
        }),
      );
    }
  }

  async getMatchHistory(userId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const allPlayerRows = await this.playerRepo.find({ where: { userId } });
    if (!allPlayerRows.length) return { matches: [], total: 0, page, limit };

    const allMatchIds = [...new Set(allPlayerRows.map((p) => p.matchId))];
    const completedMatches = await this.matchRepo.findBy({
      id: In(allMatchIds),
      status: MatchStatus.COMPLETED,
    });
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
        totalRounds: m.totalRounds ?? 0,
        createdAt,
        eloChange:   pick(rows, 'eloChange'),
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

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = merged.length;
    return { matches: merged.slice(skip, skip + limit), total, page, limit };
  }
}
