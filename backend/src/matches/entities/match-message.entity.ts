import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('match_messages')
export class MatchMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'match_id' })
  matchId: number;

  @Column({ name: 'user_id' })
  userId: number;

  // Денормализуем для отображения без доп. джойнов
  @Column({ name: 'nickname', default: '' })
  nickname: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  // 'A' | 'B' — для подсветки команды
  @Column({ default: 'A' })
  team: string;

  @Column({ type: 'text' })
  text: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
