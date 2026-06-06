import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportMessage } from './entities/support-message.entity';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SupportMessage, User, Notification])],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
