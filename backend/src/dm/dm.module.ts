import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DmController } from './dm.controller';
import { DmService } from './dm.service';
import { DmProLobby } from './entities/dm-pro-lobby.entity';
import { User } from '../users/entities/user.entity';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [TypeOrmModule.forFeature([DmProLobby, User]), GatewayModule],
  controllers: [DmController],
  providers: [DmService],
  exports: [DmService],
})
export class DmModule {}
