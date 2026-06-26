import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportMessage } from './entities/support-message.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SupportMessage, SupportTicket, User, Notification])],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
