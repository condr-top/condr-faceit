import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { Mission } from './entities/mission.entity';
import { UserMission } from './entities/user-mission.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Mission, UserMission, User, Notification])],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
