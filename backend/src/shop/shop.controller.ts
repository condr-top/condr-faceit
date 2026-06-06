import { Controller, Get, Post, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShopService } from './shop.service';

@Controller('shop')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private shopService: ShopService) {}

  @Get()
  getItems() {
    return this.shopService.getItems();
  }

  @Get('inventory')
  getInventory(@Request() req: any) {
    return this.shopService.getUserInventory(req.user.id);
  }

  @Post(':id/buy')
  buy(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.shopService.buyWithCoins(req.user.id, id);
  }
}
