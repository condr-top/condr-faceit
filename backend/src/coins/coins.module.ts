import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoinsController } from './coins.controller';
import { CoinsService } from './coins.service';
import { CoinPurchase } from './entities/coin-purchase.entity';
import { User } from '../users/entities/user.entity';
import { ReportsModule } from '../reports/reports.module';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [TypeOrmModule.forFeature([CoinPurchase, User]), ReportsModule, MatchesModule],
  controllers: [CoinsController],
  providers: [CoinsService],
})
export class CoinsModule {}
