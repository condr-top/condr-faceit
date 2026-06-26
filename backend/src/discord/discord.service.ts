import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  Client, GatewayIntentBits, ChannelType,
  PermissionsBitField, Guild, Role,
} from 'discord.js';

export interface MatchTeams {
  matchId: number
  teamT:  string[]  // Discord usernames for T side
  teamCT: string[]  // Discord usernames for CT side
}

@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private client: Client | null = null;
  private readonly guildId:    string;
  private readonly categoryId: string;
  private lastError: string | null = null;
  private lastErrorAt: Date | null = null;
  private loginError: string | null = null;

  constructor() {
    this.guildId    = process.env.DISCORD_GUILD_ID    || '';
    this.categoryId = process.env.DISCORD_CATEGORY_ID || '';
  }

  async onModuleInit() {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token || !this.guildId) return;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,   // needed for member search
        GatewayIntentBits.GuildVoiceStates,
      ],
    });

    this.client.on('ready', () => {
      this.logger.log(`Discord bot ready: ${this.client!.user?.tag}`);
      // НЕ зачищаем каналы автоматически: 'ready' может срабатывать при
      // реконнекте и снёс бы каналы активных матчей. Зачистка за собой
      // делается при отмене/завершении матча (deleteMatchVoiceRooms).
    });

    // Ловим сетевые ошибки клиента, чтобы они не всплывали как uncaught
    // и не роняли весь бэкенд (Discord под ТСПУ может быть недоступен).
    this.client.on('error', (e: any) => this.logger.warn(`Discord client error: ${e?.message}`));
    (this.client as any).on('shardError', (e: any) => this.logger.warn(`Discord shard error: ${e?.message}`));

    // login не должен валить старт приложения; ретраим в фоне.
    this.client.login(token).catch((e: any) => {
      this.loginError = e?.message ?? String(e);
      this.logger.warn(`Discord login failed: ${e?.message} — голосовые комнаты будут недоступны`);
    });
  }

  async onModuleDestroy() { this.client?.destroy(); }

  // Категория необязательна: без неё каналы создаются в корне сервера.
  isReady(): boolean {
    return !!this.client?.isReady() && !!this.guildId;
  }

  /** Диагностика для админ-панели — почему не создаются голосовые комнаты. */
  getStatus() {
    return {
      hasToken: !!process.env.DISCORD_BOT_TOKEN,
      guildId: this.guildId || null,
      categoryId: this.categoryId || null,
      clientReady: !!this.client?.isReady(),
      ready: this.isReady(),
      botTag: this.client?.user?.tag ?? null,
      loginError: this.loginError,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt,
    };
  }

  /** Пробное создание+удаление голосового канала. Возвращает точный шаг и ошибку. */
  async testVoice(): Promise<{ ok: boolean; step?: string; error?: string; steps: string[]; categoryUsed?: boolean }> {
    const steps: string[] = [];
    if (!this.client?.isReady()) return { ok: false, step: 'login', error: this.loginError || 'бот не подключён к Discord', steps };
    if (!this.guildId) return { ok: false, step: 'config', error: 'DISCORD_GUILD_ID не задан', steps };
    let guild: Guild;
    try { guild = await this.client.guilds.fetch(this.guildId); steps.push('guild fetched'); }
    catch (e: any) { return { ok: false, step: 'guilds.fetch', error: e?.message, steps }; }

    let role: Role | null = null;
    try { role = await guild.roles.create({ name: 'CONDR-test', hoist: false }); steps.push('role created'); }
    catch (e: any) { return { ok: false, step: 'roles.create', error: e?.message, steps }; }

    let chan: any = null;
    try {
      chan = await guild.channels.create({
        name: 'condr-test',
        type: ChannelType.GuildVoice,
        ...(this.categoryId ? { parent: this.categoryId } : {}),
      });
      steps.push('channel created');
    } catch (e: any) {
      await role.delete().catch(() => {});
      return { ok: false, step: 'channels.create', error: e?.message, steps, categoryUsed: !!this.categoryId };
    }

    try { await chan.createInvite({ maxAge: 60, maxUses: 1, unique: true }); steps.push('invite created'); }
    catch (e: any) {
      await chan.delete().catch(() => {});
      await role.delete().catch(() => {});
      return { ok: false, step: 'createInvite', error: e?.message, steps };
    }

    await chan.delete().catch(() => {});
    await role.delete().catch(() => {});
    return { ok: true, steps, categoryUsed: !!this.categoryId };
  }

  // ─────────────────────────────────────────────────────────────────────────
  async createMatchVoiceRooms(
    matchId: number,
    teamSize = 5,
    teams?: MatchTeams,
  ): Promise<{ channelTId: string; channelCTId: string; inviteT: string; inviteCT: string } | null> {

    if (!this.client?.isReady() || !this.guildId) {
      this.logger.warn('Discord not ready');
      return null;
    }

    try {
      const guild = await this.client.guilds.fetch(this.guildId);

      // 1. Create per-match roles
      const [roleT, roleCT] = await Promise.all([
        guild.roles.create({ name: `M${matchId}-T`,  color: 0xEAB308, hoist: false }),
        guild.roles.create({ name: `M${matchId}-CT`, color: 0x60A5FA, hoist: false }),
      ]);

      this.logger.log(`Match #${matchId}: created roles T=${roleT.id} CT=${roleCT.id}`);

      // 2. Assign roles to players by Discord username
      if (teams) {
        await this.assignRolesToPlayers(guild, roleT,  teams.teamT);
        await this.assignRolesToPlayers(guild, roleCT, teams.teamCT);
      }

      // 3. Channel permissions: @everyone denied, role allowed
      const makePerms = (roleId: string) => [
        {
          id:   guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect],
        },
        {
          id:    roleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak,
          ],
        },
        {
          id:    this.client!.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.MoveMembers,
            PermissionsBitField.Flags.ManageChannels,
          ],
        },
      ];

      // 4. Create voice channels
      const parentOpt = this.categoryId ? { parent: this.categoryId } : {};
      const [chanT, chanCT] = await Promise.all([
        guild.channels.create({
          name: `💣 Матч #${matchId} — Терры`,
          type: ChannelType.GuildVoice,
          ...parentOpt,
          userLimit: teamSize,
          permissionOverwrites: makePerms(roleT.id),
        }),
        guild.channels.create({
          name: `🛡️ Матч #${matchId} — КТ`,
          type: ChannelType.GuildVoice,
          ...parentOpt,
          userLimit: teamSize,
          permissionOverwrites: makePerms(roleCT.id),
        }),
      ]);

      // 5. Create invites
      const [invT, invCT] = await Promise.all([
        (chanT as any).createInvite({ maxAge: 7200, maxUses: teamSize, unique: true }),
        (chanCT as any).createInvite({ maxAge: 7200, maxUses: teamSize, unique: true }),
      ]);

      this.logger.log(
        `Match #${matchId}: T=${chanT.id} CT=${chanCT.id} ` +
        `invT=${invT.code} invCT=${invCT.code}`
      );

      // Store role IDs on channels for cleanup
      (chanT as any)._roleT  = roleT.id;
      (chanCT as any)._roleCT = roleCT.id;

      // Keep track for deletion
      this._matchRoles.set(chanT.id,  roleT.id);
      this._matchRoles.set(chanCT.id, roleCT.id);

      return {
        channelTId:  chanT.id,
        channelCTId: chanCT.id,
        inviteT:  `https://discord.gg/${invT.code}`,
        inviteCT: `https://discord.gg/${invCT.code}`,
      };
    } catch (err: any) {
      this.lastError = `${err?.message ?? err}`;
      this.lastErrorAt = new Date();
      this.logger.error(`createMatchVoiceRooms #${matchId}: ${err?.message}`, err?.stack);
      return null;
    }
  }

  // channelId → roleId mapping for cleanup
  private readonly _matchRoles = new Map<string, string>();

  // ── Удалить ВСЕ матчевые голосовые каналы и роли (зачистка) ───────────────
  async cleanupAllMatchRooms(): Promise<void> {
    if (!this.client?.isReady() || !this.guildId) return;
    try {
      const guild = await this.client.guilds.fetch(this.guildId);

      // 1. Голосовые каналы матчей (в нашей категории, с именем «Матч #…»)
      const channels = await guild.channels.fetch();
      let chCount = 0;
      for (const ch of channels.values()) {
        if (!ch) continue;
        const isMatchVoice =
          ch.type === ChannelType.GuildVoice &&
          (!this.categoryId || ch.parentId === this.categoryId) &&
          /Матч #\d+/.test(ch.name);
        if (isMatchVoice) {
          await ch.delete().catch(() => {});
          chCount++;
        }
      }

      // 2. Матчевые роли вида M{id}-T / M{id}-CT
      const roles = await guild.roles.fetch();
      let roleCount = 0;
      for (const r of roles.values()) {
        if (r && /^M\d+-(T|CT)$/.test(r.name)) {
          await r.delete().catch(() => {});
          roleCount++;
        }
      }
      this._matchRoles.clear();
      this.logger.log(`cleanupAllMatchRooms: удалено каналов=${chCount}, ролей=${roleCount}`);
    } catch (err: any) {
      this.logger.warn(`cleanupAllMatchRooms: ${err?.message}`);
    }
  }

  // ── Assign role to players by Discord username ────────────────────────────
  private async assignRolesToPlayers(guild: Guild, role: Role, usernames: string[]) {
    for (const username of usernames) {
      if (!username) continue;
      try {
        // Search members by username (requires GuildMembers intent)
        const results = await guild.members.search({ query: username, limit: 10 });
        const member  = results.find(
          m => m.user.username.toLowerCase() === username.toLowerCase() ||
               m.displayName.toLowerCase()   === username.toLowerCase()
        );
        if (member) {
          await member.roles.add(role);
          this.logger.log(`Assigned role ${role.name} → ${member.user.username}`);
        } else {
          this.logger.warn(`Member not found on server: "${username}"`);
        }
      } catch (e: any) {
        this.logger.warn(`assignRole "${username}": ${e?.message}`);
      }
    }
  }

  // ── Delete channels + roles ───────────────────────────────────────────────
  async deleteMatchVoiceRooms(channelTId?: string, channelCTId?: string): Promise<void> {
    if (!this.client?.isReady()) return;

    for (const chanId of [channelTId, channelCTId].filter(Boolean) as string[]) {
      try {
        const ch = await this.client.channels.fetch(chanId).catch(() => null);
        if (ch) await ch.delete();
      } catch {}

      // Delete associated role
      const roleId = this._matchRoles.get(chanId);
      if (roleId) {
        try {
          const guild = await this.client.guilds.fetch(this.guildId);
          await guild.roles.delete(roleId);
        } catch {}
        this._matchRoles.delete(chanId);
      }
    }
  }
}
