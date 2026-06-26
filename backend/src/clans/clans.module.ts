import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clan } from './entities/clan.entity';
import { ClanMember } from './entities/clan-member.entity';
import { ClanRequest } from './entities/clan-request.entity';
import { ClanMatch } from './entities/clan-match.entity';
import { ClanEvent } from './entities/clan-event.entity';
import { ClanScrimListing } from './entities/clan-scrim-listing.entity';
import { ClanScrimResponse } from './entities/clan-scrim-response.entity';
import { ClanSeason } from './entities/clan-season.entity';
import { ClanSeasonResult } from './entities/clan-season-result.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ClansService } from './clans.service';
import { ClansController } from './clans.controller';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Clan, ClanMember, ClanRequest, ClanMatch, ClanEvent, ClanScrimListing, ClanScrimResponse, ClanSeason, ClanSeasonResult, User, Notification]),
    GatewayModule,
  ],
  controllers: [ClansController],
  providers: [ClansService],
  exports: [ClansService],
})
export class ClansModule {}
