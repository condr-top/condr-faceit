import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MatchesModule } from './matches/matches.module';
import { QueueModule } from './queue/queue.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { MissionsModule } from './missions/missions.module';
import { AchievementsModule } from './achievements/achievements.module';
import { ShopModule } from './shop/shop.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GatewayModule } from './gateway/gateway.module';
import { CoinsModule } from './coins/coins.module';
import { ReportsModule } from './reports/reports.module';
import { SupportModule } from './support/support.module';
import { SupportMessage } from './support/entities/support-message.entity';
import { Report } from './reports/entities/report.entity';
import { User } from './users/entities/user.entity';
import { Match } from './matches/entities/match.entity';
import { MatchPlayer } from './matches/entities/match-player.entity';
import { Mission } from './missions/entities/mission.entity';
import { UserMission } from './missions/entities/user-mission.entity';
import { Achievement } from './achievements/entities/achievement.entity';
import { UserAchievement } from './achievements/entities/user-achievement.entity';
import { ShopItem } from './shop/entities/shop-item.entity';
import { UserInventory } from './shop/entities/user-inventory.entity';
import { Tournament } from './tournaments/entities/tournament.entity';
import { TournamentParticipant } from './tournaments/entities/tournament-participant.entity';
import { Notification } from './notifications/entities/notification.entity';
import { DailyReward } from './users/entities/daily-reward.entity';
import { Friendship } from './users/entities/friendship.entity';
import { CoinPurchase } from './coins/entities/coin-purchase.entity';
import { EloHistory } from './users/entities/elo-history.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.get('DATABASE_URL'),
        entities: [
          User,
          Match,
          MatchPlayer,
          Mission,
          UserMission,
          Achievement,
          UserAchievement,
          ShopItem,
          UserInventory,
          Tournament,
          TournamentParticipant,
          Notification,
          DailyReward,
          Friendship,
          CoinPurchase,
          Report,
          SupportMessage,
          EloHistory,
        ],
        synchronize: true,
        logging: false,
        // Connection pool tuning for 1000 concurrent users
        extra: {
          max: 20,           // max 20 DB connections in pool
          min: 5,            // keep 5 warm connections
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]), // 200 req/min (active match player makes ~40/min)
    AuthModule,
    UsersModule,
    MatchesModule,
    QueueModule,
    LeaderboardModule,
    MissionsModule,
    AchievementsModule,
    ShopModule,
    TournamentsModule,
    AdminModule,
    NotificationsModule,
    GatewayModule,
    CoinsModule,
    ReportsModule,
    SupportModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // global rate limit
  ],
})
export class AppModule {}
