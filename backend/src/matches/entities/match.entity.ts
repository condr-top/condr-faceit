import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MatchStatus {
  WAITING = 'waiting',
  READY_CHECK = 'ready_check',
  MAP_VETO = 'map_veto',
  IN_PROGRESS = 'in_progress',
  RESULT_PENDING = 'result_pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export const MAPS = ['PRISON', 'SANDSTONE', 'PROVINCE', 'BREEZE', 'HANAMI', 'RUST', 'DUNE'];

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.WAITING })
  status: MatchStatus;

  @Column({ name: 'team_a_ids', type: 'int', array: true, default: [] })
  teamAIds: number[];

  @Column({ name: 'team_b_ids', type: 'int', array: true, default: [] })
  teamBIds: number[];

  @Column({ name: 'team_a_elo', default: 0 })
  teamAElo: number;

  @Column({ name: 'team_b_elo', default: 0 })
  teamBElo: number;

  @Column({ name: 'host_id', nullable: true })
  hostId: number;

  @Column({ nullable: true })
  map: string;

  @Column({ name: 'veto_phase', default: 0 })
  vetoPhase: number;

  @Column({ name: 'available_maps', type: 'text', array: true, default: MAPS })
  availableMaps: string[];

  @Column({ name: 'veto_turn', nullable: true })
  vetoTurn: string;

  @Column({ name: 'captain_a_id', nullable: true })
  captainAId: number;

  @Column({ name: 'captain_b_id', nullable: true })
  captainBId: number;

  @Column({ name: 'team_a_side', nullable: true })
  teamASide: string; // 'T' | 'CT'

  @Column({ name: 'ready_players', type: 'int', array: true, default: [] })
  readyPlayers: number[];

  @Column({ name: 'ready_check_expires', nullable: true, type: 'timestamp' })
  readyCheckExpires: Date;

  @Column({ name: 'score_a', default: 0 })
  scoreA: number;

  @Column({ name: 'score_b', default: 0 })
  scoreB: number;

  // Scores submitted by each captain independently
  @Column({ name: 'score_a_by_cap_a', nullable: true, type: 'int' })
  scoreAByCapA: number;

  @Column({ name: 'score_b_by_cap_a', nullable: true, type: 'int' })
  scoreBByCapA: number;

  @Column({ name: 'score_a_by_cap_b', nullable: true, type: 'int' })
  scoreAByCapB: number;

  @Column({ name: 'score_b_by_cap_b', nullable: true, type: 'int' })
  scoreBByCapB: number;

  @Column({ name: 'is_disputed', default: false })
  isDisputed: boolean;

  @Column({ name: 'kd_submitted', default: false })
  kdSubmitted: boolean;

  @Column({ name: 'total_rounds', nullable: true, type: 'int' })
  totalRounds: number;

  @Column({ name: 'winner_team', nullable: true })
  winnerTeam: string;

  @Column({ name: 'result_screenshot_a', nullable: true })
  resultScreenshotA: string;

  @Column({ name: 'result_screenshot_b', nullable: true })
  resultScreenshotB: string;

  @Column({ name: 'result_confirmed_by', type: 'int', array: true, default: [] })
  resultConfirmedBy: number[];

  @Column({ name: 'lobby_link', nullable: true })
  lobbyLink: string;

  // Players who confirmed they joined the lobby (clicked the link)
  @Column({ name: 'lobby_joined_players', type: 'int', array: true, default: [] })
  lobbyJoinedPlayers: number[];

  // When the host published the lobby link (start of 5-min join window)
  @Column({ name: 'lobby_link_published_at', nullable: true, type: 'timestamp' })
  lobbyLinkPublishedAt: Date;

  // Хост может изменить ссылку только один раз после первой публикации
  @Column({ name: 'lobby_link_changed', default: false })
  lobbyLinkChanged: boolean;

  @Column({ name: 'room_code', nullable: true })
  roomCode: string;

  @Column({ name: 'room_password', nullable: true })
  roomPassword: string;

  // Discord voice rooms
  @Column({ name: 'voice_channel_t_id', nullable: true })
  voiceChannelTId: string;

  @Column({ name: 'voice_channel_ct_id', nullable: true })
  voiceChannelCTId: string;

  @Column({ name: 'voice_invite_t', nullable: true })
  voiceInviteT: string;

  @Column({ name: 'voice_invite_ct', nullable: true })
  voiceInviteCT: string;

  @Column({ name: 'elo_change', default: 0 })
  eloChange: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'started_at', nullable: true, type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'ended_at', nullable: true, type: 'timestamp' })
  endedAt: Date;

  // Set when first captain submits result — used to auto-escalate if second never submits
  @Column({ name: 'first_result_at', nullable: true, type: 'timestamp' })
  firstResultAt: Date;
}
