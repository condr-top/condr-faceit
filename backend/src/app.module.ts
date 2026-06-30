import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MatchesModule } from './matches/matches.module';
import { PartyModule } from './party/party.module';
import { DmModule } from './dm/dm.module';
import { DmProLobby } from './dm/entities/dm-pro-lobby.entity';
import { CplModule } from './cpl/cpl.module';
import { Season } from './cpl/entities/season.entity';
import { CplWeekly } from './cpl/entities/cpl-weekly.entity';
import { CplStanding } from './cpl/entities/cpl-standing.entity';
import { QueueModule } from './queue/queue.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { MissionsModule } from './missions/missions.module';
import { AchievementsModule } from './achievements/achievements.module';
import { ShopModule } from './shop/shop.module';
import { GamesModule } from './games/games.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GatewayModule } from './gateway/gateway.module';
import { CoinsModule } from './coins/coins.module';
import { ReportsModule } from './reports/reports.module';
import { SupportModule } from './support/support.module';
import { SupportMessage } from './support/entities/support-message.entity';
import { SupportTicket } from './support/entities/support-ticket.entity';
import { Report } from './reports/entities/report.entity';
import { User } from './users/entities/user.entity';
import { Match } from './matches/entities/match.entity';
import { MatchPlayer } from './matches/entities/match-player.entity';
import { MatchMessage } from './matches/entities/match-message.entity';
import { Mission } from './missions/entities/mission.entity';
import { UserMission } from './missions/entities/user-mission.entity';
import { Achievement } from './achievements/entities/achievement.entity';
import { UserAchievement } from './achievements/entities/user-achievement.entity';
import { ShopItem } from './shop/entities/shop-item.entity';
import { UserInventory } from './shop/entities/user-inventory.entity';
import { Tournament } from './tournaments/entities/tournament.entity';
import { TournamentParticipant } from './tournaments/entities/tournament-participant.entity';
import { Notification } from './notifications/entities/notification.entity';
import { Friendship } from './users/entities/friendship.entity';
import { CoinPurchase } from './coins/entities/coin-purchase.entity';
import { EloHistory } from './users/entities/elo-history.entity';
import { AppMeta } from './admin/entities/app-meta.entity';
import { ClansModule } from './clans/clans.module';
import { Clan } from './clans/entities/clan.entity';
import { ClanMember } from './clans/entities/clan-member.entity';
import { ClanRequest } from './clans/entities/clan-request.entity';
import { ClanMatch } from './clans/entities/clan-match.entity';
import { ClanEvent } from './clans/entities/clan-event.entity';
import { ClanScrimListing } from './clans/entities/clan-scrim-listing.entity';
import { ClanScrimResponse } from './clans/entities/clan-scrim-response.entity';
import { ClanSeason } from './clans/entities/clan-season.entity';
import { ClanSeasonResult } from './clans/entities/clan-season-result.entity';
import { InviteModule } from './invite/invite.module';
import { InviteCode } from './invite/entities/invite-code.entity';

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
          MatchMessage,
          Mission,
          UserMission,
          Achievement,
          UserAchievement,
          ShopItem,
          UserInventory,
          Tournament,
          TournamentParticipant,
          Notification,
          Friendship,
          CoinPurchase,
          Report,
          SupportMessage,
          SupportTicket,
          EloHistory,
          AppMeta,
          Clan,
          ClanMember,
          ClanRequest,
          ClanMatch,
          ClanEvent,
          ClanScrimListing,
          ClanScrimResponse,
          ClanSeason,
          ClanSeasonResult,
          DmProLobby,
          Season,
          CplWeekly,
          CplStanding,
          InviteCode,
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
    PartyModule,
    DmModule,
    CplModule,
    QueueModule,
    LeaderboardModule,
    MissionsModule,
    AchievementsModule,
    ShopModule,
    GamesModule,
    TournamentsModule,
    AdminModule,
    NotificationsModule,
    GatewayModule,
    CoinsModule,
    ReportsModule,
    SupportModule,
    ClansModule,
    InviteModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // global rate limit
  ],
})
export class AppModule {}
