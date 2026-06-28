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

  @Post('premium')
  buyPremium(@Request() req: any) {
    return this.shopService.buyPremium(req.user.id);
  }

  @Post('cplq')
  buyCplq(@Request() req: any) {
    return this.shopService.buyCplq(req.user.id);
  }

  // ── Услуги ──
  @Post('service/kd-reset')
  kdReset(@Request() req: any) {
    return this.shopService.kdReset(req.user.id);
  }

  @Post('service/clean-slate')
  cleanSlate(@Request() req: any) {
    return this.shopService.cleanSlate(req.user.id);
  }

  @Post('service/warn-remove')
  warnRemove(@Request() req: any) {
    return this.shopService.warnRemove(req.user.id);
  }

  @Post('service/boost')
  buyBoost(@Request() req: any) {
    return this.shopService.buyBoost(req.user.id);
  }

  @Post('service/condr-tag')
  buyCondrTag(@Request() req: any) {
    return this.shopService.buyCondrTag(req.user.id);
  }

  @Post(':id/buy')
  buy(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.shopService.buyWithCoins(req.user.id, id);
  }
}
