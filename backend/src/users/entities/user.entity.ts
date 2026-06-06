import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ name: 'telegram_id', type: 'bigint' })
  telegramId: number;

  @Column({ nullable: true })
  username: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ default: 1000 })
  elo: number;

  @Column({ default: 0 })
  coins: number;

  @Column({ default: 0 })
  xp: number;

  @Column({ default: 1 })
  level: number;

  @Column({ name: 'matches_played', default: 0 })
  matchesPlayed: number;

  @Column({ name: 'matches_won', default: 0 })
  matchesWon: number;

  @Column({ name: 'matches_lost', default: 0 })
  matchesLost: number;

  @Column({ name: 'kills_total', default: 0 })
  killsTotal: number;

  @Column({ name: 'deaths_total', default: 0 })
  deathsTotal: number;

  @Column({ name: 'assists_total', default: 0 })
  assistsTotal: number;

  @Column({ name: 'rating_sum', type: 'float', default: 0 })
  ratingSum: number;

  @Column({ name: 'is_admin', default: false })
  isAdmin: boolean;

  @Column({ name: 'is_moderator', default: false })
  isModerator: boolean;

  @Column({ name: 'is_banned', default: false })
  isBanned: boolean;

  @Column({ name: 'ban_reason', nullable: true })
  banReason: string;

  @Column({ name: 'warns', default: 0 })
  warns: number;

  @Column({ name: 'premium_until', nullable: true, type: 'timestamp' })
  premiumUntil: Date;

  @Column({ name: 'last_login_reward', nullable: true, type: 'timestamp' })
  lastLoginReward: Date;

  @Column({ name: 'login_streak', default: 0 })
  loginStreak: number;

  @Column({ name: 'game_nickname', nullable: true })
  gameNickname: string;

  @Column({ name: 'game_id', nullable: true })
  gameId: string;

  @Column({ name: 'device_serial', nullable: true })
  deviceSerial: string;

  @Column({ name: 'is_registered', default: false })
  isRegistered: boolean;

  @Column({ name: 'nickname_changes_used', default: 0 })
  nicknameChangesUsed: number;

  /** Active queue / lobby cooldown (dodge / leave penalty). */
  @Column({ name: 'cooldown_until', nullable: true, type: 'timestamp' })
  cooldownUntil: Date | null;

  /** Consecutive win streak (resets on loss/draw) */
  @Column({ name: 'win_streak', default: 0 })
  winStreak: number;

  /** How many days in a row all 3 daily missions were completed */
  @Column({ name: 'mission_streak', default: 0 })
  missionStreak: number;

  /** Last date (YYYY-MM-DD UTC) the daily bonus was claimed */
  @Column({ name: 'mission_streak_last_date', nullable: true })
  missionStreakLastDate: string | null;

  /** Number of leave/AFK penalties (used for escalating cooldowns). */
  @Column({ name: 'leave_count', default: 0 })
  leaveCount: number;

  /** Privacy: hide Telegram username from other players */
  @Column({ name: 'hide_username', default: false })
  hideUsername: boolean;

  /** Discord username (e.g. "lordAlekss") for voice channel role assignment */
  @Column({ name: 'discord_username', nullable: true })
  discordUsername: string | null;

  /** ISO country code e.g. "RU", "UA", "KZ" */
  @Column({ name: 'region', nullable: true })
  region: string | null;

  /** When region was last changed (7-day cooldown) */
  @Column({ name: 'region_updated_at', nullable: true, type: 'timestamp' })
  regionUpdatedAt: Date | null;

  /** Mini-game plays today (resets daily) */
  @Column({ name: 'mini_game_plays_today', default: 0 })
  miniGamePlaysToday: number;

  /** Date of last mini-game play (YYYY-MM-DD UTC) */
  @Column({ name: 'mini_game_last_date', nullable: true })
  miniGameLastDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  get displayName(): string {
    return this.username ? `@${this.username}` : `${this.firstName}${this.lastName ? ' ' + this.lastName : ''}`;
  }

  get isPremium(): boolean {
    return this.premiumUntil != null && this.premiumUntil > new Date();
  }

  get isOnCooldown(): boolean {
    return this.cooldownUntil != null && this.cooldownUntil > new Date();
  }

  get kdr(): number {
    if (this.deathsTotal === 0) return this.killsTotal;
    return Math.round((this.killsTotal / this.deathsTotal) * 100) / 100;
  }

  get winRate(): number {
    const decided = this.matchesWon + this.matchesLost;
    if (decided === 0) return 0;
    return Math.round((this.matchesWon / decided) * 1000) / 10;
  }

  get avgKills(): number {
    if (this.matchesPlayed === 0) return 0;
    return Math.floor(this.killsTotal / this.matchesPlayed);
  }

  get ratingOverall(): number {
    if (this.matchesPlayed === 0) return 0;
    return Math.round((this.ratingSum / this.matchesPlayed) * 100) / 100;
  }
}
