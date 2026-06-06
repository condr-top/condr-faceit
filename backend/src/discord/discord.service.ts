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

    this.client.on('ready', () =>
      this.logger.log(`Discord bot ready: ${this.client!.user?.tag}`)
    );

    await this.client.login(token);
  }

  async onModuleDestroy() { this.client?.destroy(); }

  // ─────────────────────────────────────────────────────────────────────────
  async createMatchVoiceRooms(
    matchId: number,
    teamSize = 2,
    teams?: MatchTeams,
  ): Promise<{ channelTId: string; channelCTId: string; inviteT: string; inviteCT: string } | null> {

    if (!this.client?.isReady() || !this.guildId || !this.categoryId) {
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
      const [chanT, chanCT] = await Promise.all([
        guild.channels.create({
          name: `💣 Матч #${matchId} — Терры`,
          type: ChannelType.GuildVoice,
          parent: this.categoryId,
          userLimit: teamSize,
          permissionOverwrites: makePerms(roleT.id),
        }),
        guild.channels.create({
          name: `🛡️ Матч #${matchId} — КТ`,
          type: ChannelType.GuildVoice,
          parent: this.categoryId,
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
      this.logger.error(`createMatchVoiceRooms #${matchId}: ${err?.message}`);
      return null;
    }
  }

  // channelId → roleId mapping for cleanup
  private readonly _matchRoles = new Map<string, string>();

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
