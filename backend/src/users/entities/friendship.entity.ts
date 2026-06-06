import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum FriendshipStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
}

@Entity('friendships')
@Index(['userId', 'friendId'], { unique: true })
export class Friendship {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'friend_id' })
  friendId: number;

  @Column({ type: 'enum', enum: FriendshipStatus, default: FriendshipStatus.PENDING })
  status: FriendshipStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
