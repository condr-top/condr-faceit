import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramNotifyService } from './telegram-notify.service';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [TelegramNotifyService],
  exports: [TelegramNotifyService],
})
export class TelegramNotifyModule {}
