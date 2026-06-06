import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { ShopItem } from './entities/shop-item.entity';
import { UserInventory } from './entities/user-inventory.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShopItem, UserInventory, User])],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
