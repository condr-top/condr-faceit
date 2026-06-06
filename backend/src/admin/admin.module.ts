import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Match } from '../matches/entities/match.entity';
import { MatchPlayer } from '../matches/entities/match-player.entity';
import { Mission } from '../missions/entities/mission.entity';
import { ShopItem } from '../shop/entities/shop-item.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Report } from '../reports/entities/report.entity';
import { CoinPurchase } from '../coins/entities/coin-purchase.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { EloHistory } from '../users/entities/elo-history.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { MissionsModule } from '../missions/missions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Match, MatchPlayer, Mission, ShopItem, Tournament, Report, CoinPurchase, Notification, EloHistory]),
    GatewayModule,
    MissionsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
